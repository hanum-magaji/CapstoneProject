// api/submit.js
//
// POST /api/submit
//
// 1. Validates the stakeholder token
// 2. Saves the raw submission (with embedding)
// 3. Asynchronously:
//    a. Uses GPT to split the raw text into individual requirements
//    b. Embeds each requirement
//    c. Assigns each to the nearest existing cluster (cosine ≥ CLUSTER_THRESHOLD)
//       or creates a new cluster if none matches
//    d. Saves to processed_requirements

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Minimum cosine similarity for a requirement to join an existing cluster
const CLUSTER_THRESHOLD = 0.72;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Use GPT-4o-mini to split raw stakeholder text into individual,
 * atomic, well-formed requirements.
 * Returns an array of requirement strings.
 */
async function extractRequirements(rawText, projectContext) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a requirements analyst. Your task is to read natural language stakeholder input and extract individual, atomic, well-formed software/project requirements from it.

Rules:
- Each requirement must be a single, testable statement.
- Use clear language: "The system shall...", "Users must be able to...", or "The platform should...".
- Do NOT merge multiple concerns into one requirement.
- Do NOT invent requirements that aren't implied by the input.
- Return ONLY a JSON array of requirement strings. No explanation.

Example output: ["The system shall send email notifications to users.", "Users must be able to reset their password."]`,
      },
      {
        role: "user",
        content: `Project context: ${projectContext || "a software project"}\n\nStakeholder input:\n"${rawText}"\n\nExtract all individual requirements from this input.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 800,
    temperature: 0.3,
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content);
    // GPT may return { requirements: [...] } or just [...]
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.requirements)) return parsed.requirements;
    // Fallback: find any array value
    const arrayVal = Object.values(parsed).find(Array.isArray);
    return arrayVal || [rawText];
  } catch {
    return [rawText];
  }
}

/**
 * Embed a single text string using text-embedding-3-small.
 * Returns float[] or null on failure.
 */
async function embed(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error("Embedding failed:", err.message);
    return null;
  }
}

/**
 * Compute the centroid of all processed_requirements that belong to a cluster.
 * Returns float[] or null if the cluster has no embedded requirements.
 */
async function getClusterCentroid(clusterId) {
  const { data: reqs } = await supabase
    .from("processed_requirements")
    .select("embedding")
    .eq("cluster_id", clusterId)
    .not("embedding", "is", null);

  if (!reqs || reqs.length === 0) return null;

  const embeddings = reqs.map((r) =>
    typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding
  );
  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) centroid[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= embeddings.length;
  return centroid;
}

/**
 * Use GPT to generate a short label + summary for a new cluster
 * seeded with a single requirement.
 */
async function labelNewCluster(requirementText) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          'You are a requirements analyst. Given a requirement, produce: (1) a short cluster label (3-5 words), (2) a one-sentence summary. Respond in JSON: { "label": string, "summary": string }',
      },
      {
        role: "user",
        content: `Requirement: "${requirementText}"\n\nProvide a label and summary for a cluster that would contain this requirement.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 120,
  });
  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { label: "General Requirements", summary: "A group of related requirements." };
  }
}

/**
 * Core NLP pipeline: extract, embed, cluster, and save processed requirements.
 * Called fire-and-forget after the submission is saved — errors are logged only.
 */
export async function processSubmission({ submissionId, projectId, rawText, projectName, projectDescription }) {
  try {
    const projectContext = [projectName, projectDescription].filter(Boolean).join(" — ");

    // 1. Extract individual requirements via GPT
    const requirements = await extractRequirements(rawText, projectContext);
    if (!requirements || requirements.length === 0) return;

    // 2. Fetch existing clusters for this project
    const { data: existingClusters } = await supabase
      .from("requirement_clusters")
      .select("id, label, summary, submission_count")
      .eq("project_id", projectId);

    // Build centroid map: { clusterId -> float[] }
    const centroidMap = {};
    if (existingClusters && existingClusters.length > 0) {
      await Promise.all(
        existingClusters.map(async (c) => {
          const centroid = await getClusterCentroid(c.id);
          if (centroid) centroidMap[c.id] = centroid;
        })
      );
    }

    // 3. Process each requirement: embed + assign/create cluster
    for (const reqText of requirements) {
      if (!reqText || typeof reqText !== "string" || reqText.trim().length < 5) continue;

      const reqEmbedding = await embed(reqText.trim());

      let assignedClusterId = null;

      if (reqEmbedding && Object.keys(centroidMap).length > 0) {
        // Find the most similar existing cluster
        let bestSim = -1;
        let bestClusterId = null;
        for (const [cId, centroid] of Object.entries(centroidMap)) {
          const sim = cosineSimilarity(reqEmbedding, centroid);
          if (sim > bestSim) {
            bestSim = sim;
            bestClusterId = cId;
          }
        }

        if (bestSim >= CLUSTER_THRESHOLD) {
          // Assign to the existing cluster
          assignedClusterId = bestClusterId;
          // Touch updated_at so the cluster appears as recently active
          await supabase
            .from("requirement_clusters")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", bestClusterId);
        }
      }

      if (!assignedClusterId) {
        // Create a new cluster for this requirement
        const { label, summary } = await labelNewCluster(reqText);
        const { data: newCluster, error: clusterErr } = await supabase
          .from("requirement_clusters")
          .insert({ project_id: projectId, label, summary, submission_count: 1 })
          .select("id")
          .single();

        if (clusterErr) {
          console.error("Failed to create cluster:", clusterErr);
        } else {
          assignedClusterId = newCluster.id;
          // Add new cluster centroid to map for subsequent requirements in same submission
          if (reqEmbedding) centroidMap[newCluster.id] = reqEmbedding;
        }
      }

      // 4. Save processed requirement
      const insertPayload = {
        project_id: projectId,
        submission_id: submissionId,
        text: reqText.trim(),
        cluster_id: assignedClusterId,
      };
      if (reqEmbedding) {
        insertPayload.embedding = JSON.stringify(reqEmbedding);
      }

      const { error: reqErr } = await supabase
        .from("processed_requirements")
        .insert(insertPayload);

      if (reqErr) console.error("Failed to insert processed requirement:", reqErr);
    }

    console.log(`[submit] Processed ${requirements.length} requirements for submission ${submissionId}`);
  } catch (err) {
    console.error("[submit] processSubmission error:", err);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabase) {
    return res.status(500).json({
      error: "Database not configured. Check server environment variables.",
    });
  }

  const { project_id, link_token, raw_text, stakeholder_name, stakeholder_role } =
    req.body;

  // --- Validate required fields ---

  if (!project_id || !link_token || !raw_text) {
    return res.status(400).json({
      error: "Missing required fields: project_id, link_token, and raw_text are required.",
    });
  }

  if (raw_text.trim().length < 10) {
    return res.status(400).json({
      error: "Submission text must be at least 10 characters.",
    });
  }

  if (raw_text.length > 5000) {
    return res.status(400).json({
      error: "Submission text must not exceed 5000 characters.",
    });
  }

  // --- Verify the link token matches the project ---

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, description, stakeholder_link_token")
    .eq("id", project_id)
    .single();

  if (projectError || !project) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (project.stakeholder_link_token !== link_token) {
    return res.status(403).json({ error: "Invalid submission link." });
  }

  // --- Generate embedding for the raw submission ---

  let embedding = null;
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: raw_text.trim(),
    });
    embedding = embeddingResponse.data[0].embedding;
  } catch (embeddingError) {
    console.error("Embedding generation failed:", embeddingError);
  }

  // --- Store the raw submission ---

  const insertData = {
    project_id,
    raw_text: raw_text.trim(),
    stakeholder_name: stakeholder_name || null,
    stakeholder_role: stakeholder_role || null,
  };

  if (embedding) {
    insertData.embedding = JSON.stringify(embedding);
  }

  const { data: submission, error: insertError } = await supabase
    .from("stakeholder_submissions")
    .insert([insertData])
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("Submission insert failed:", insertError);
    return res.status(500).json({
      error: "Failed to save submission. Please try again.",
    });
  }

  // --- Respond immediately so the stakeholder isn't waiting ---

  res.status(200).json({
    id: submission.id,
    created_at: submission.created_at,
    has_embedding: embedding !== null,
    processing: true,
  });

  // --- Fire-and-forget: NLP extraction + clustering ---
  // This runs after the response is sent; errors won't affect the stakeholder.

  processSubmission({
    submissionId: submission.id,
    projectId: project_id,
    rawText: raw_text.trim(),
    projectName: project.name,
    projectDescription: project.description,
  });
}
