// api/conflicts.js
// Cross-cluster and intra-cluster conflict / overlap analysis

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { syntacticSimilarity } from "./lib/textSimilarity.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Cross-cluster: contradictions, competing priorities, cross-cluster near-duplicates ----

async function detectCrossClusterIssues(clusterA, clusterB) {
  const textsA = clusterA.submissions.map((s) => `"${s.raw_text}"`).join("\n");
  const textsB = clusterB.submissions.map((s) => `"${s.raw_text}"`).join("\n");

  const prompt = `You are an expert requirements engineer analyzing two GROUPS of stakeholder needs (different clusters).

GROUP A (${clusterA.label}):
${textsA}

GROUP B (${clusterB.label}):
${textsB}

Identify issues using these categories (pick the SINGLE most important one for this pair):

1) **contradiction** — Realizing one need would block, reverse, or strongly oppose the other (policy clash, exclusive use of same resource, mutually exclusive outcomes).

2) **similar_requirement** — Different wording but substantially the same ask; consolidation would reduce duplication and confusion. Not a hard contradiction.

3) **competing_priority** — Both are valid but they compete for budget, time, staff, or roadmap ordering; stakeholders may need to sequence or trade off without abandoning either.

4) **none** — Different themes that can coexist; no action needed.

Return ONLY valid JSON:
{
  "issue_exists": true/false,
  "conflict_type": "contradiction" | "similar_requirement" | "competing_priority" | "none",
  "description": "Clear explanation for stakeholders",
  "severity": "high" | "medium" | "low",
  "resolution_suggestion": "Concrete next step: merge wording, facilitate workshop, split scope, defer one track, document assumption, etc.",
  "specific_points": ["short bullet", "short bullet"]
}

If issue_exists is false or conflict_type is none, use severity "low" and short description.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 450,
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (e) {
    console.error("detectCrossClusterIssues:", e);
    return {
      issue_exists: false,
      conflict_type: "none",
      description: "Analysis failed",
      severity: "low",
      resolution_suggestion: "Re-run analysis.",
      specific_points: [],
    };
  }
}

// ---- Intra-cluster: near-duplicate or overlapping phrasing ----

async function analyzeIntraClusterPair(subA, subB, syntacticScore) {
  const prompt = `Two stakeholder submissions appear in the SAME cluster (same general theme).

A: "${subA.raw_text}"
B: "${subB.raw_text}"
Automated syntactic overlap score: ${syntacticScore.toFixed(2)} (0–1).

Decide if teams should **merge**, **keep both** (complementary detail), or **clarify** scope.

Return ONLY JSON:
{
  "issue_exists": true/false,
  "conflict_type": "similar_requirement" | "redundant_wording" | "none",
  "description": "one sentence",
  "severity": "high" | "medium" | "low",
  "resolution_suggestion": "what to do",
  "specific_points": []
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 280,
    });
    return JSON.parse(completion.choices[0].message.content);
  } catch {
    return { issue_exists: false, conflict_type: "none", description: "", severity: "low", resolution_suggestion: "", specific_points: [] };
  }
}

async function insertConflictRow(payload) {
  const base = {
    project_id: payload.project_id,
    cluster_a_id: payload.cluster_a_id,
    cluster_b_id: payload.cluster_b_id,
    description: payload.description,
    severity: payload.severity,
    specific_points: payload.specific_points || [],
  };
  const extended = {
    ...base,
    conflict_type: payload.conflict_type || "contradiction",
    resolution_suggestion: payload.resolution_suggestion || null,
  };

  let { error } = await supabase.from("cluster_conflicts").insert(extended);
  if (error && /column|schema/i.test(error.message || "")) {
    ({ error } = await supabase.from("cluster_conflicts").insert(base));
  }
  return !error;
}

// ---- Main handler ----

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ error: "project_id required" });
  }

  try {
    const { data: clusters, error } = await supabase
      .from("requirement_clusters")
      .select("*")
      .eq("project_id", project_id)
      .order("submission_count", { ascending: false });

    if (error) throw error;
    if (!clusters || clusters.length === 0) {
      return res.status(400).json({ error: "No clusters yet. Run clustering on the Clusters page first." });
    }

    for (const cluster of clusters) {
      const { data: submissions } = await supabase
        .from("stakeholder_submissions")
        .select("id, raw_text, stakeholder_role")
        .eq("cluster_id", cluster.id);

      cluster.submissions = submissions || [];
    }

    await supabase.from("cluster_conflicts").delete().eq("project_id", project_id);

    const conflicts = [];
    const INTRA_SYNTAX_THRESHOLD = parseFloat(process.env.CONFLICT_INTRA_SYNTAX_THRESHOLD || "0.78");

    // --- Cross-cluster pairs ---
    if (clusters.length >= 2) {
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const clusterA = clusters[i];
          const clusterB = clusters[j];

          const analysis = await detectCrossClusterIssues(clusterA, clusterB);
          const type = analysis.conflict_type || "none";
          if (!analysis.issue_exists || type === "none") continue;

          const ok = await insertConflictRow({
            project_id,
            cluster_a_id: clusterA.id,
            cluster_b_id: clusterB.id,
            description: analysis.description,
            severity: analysis.severity || "medium",
            specific_points: analysis.specific_points || [],
            conflict_type: type,
            resolution_suggestion: analysis.resolution_suggestion || "",
          });

          if (ok) {
            conflicts.push({
              cluster_a_label: clusterA.label,
              cluster_b_label: clusterB.label,
              conflict_type: type,
              description: analysis.description,
            });
          }
        }
      }
    }

    // --- Intra-cluster: high syntactic overlap ---
    for (const cluster of clusters) {
      const subs = cluster.submissions;
      if (subs.length < 2) continue;

      for (let i = 0; i < subs.length; i++) {
        for (let j = i + 1; j < subs.length; j++) {
          const syn = syntacticSimilarity(subs[i].raw_text, subs[j].raw_text);
          if (syn < INTRA_SYNTAX_THRESHOLD) continue;

          const analysis = await analyzeIntraClusterPair(subs[i], subs[j], syn);
          if (!analysis.issue_exists || analysis.conflict_type === "none") continue;

          const desc = `[Within "${cluster.label}"] ${analysis.description}`;
          const ok = await insertConflictRow({
            project_id,
            cluster_a_id: cluster.id,
            cluster_b_id: cluster.id,
            description: desc,
            severity: analysis.severity || "low",
            specific_points: [
              `Submission ${subs[i].id.slice(0, 8)}…`,
              `Submission ${subs[j].id.slice(0, 8)}…`,
              ...(analysis.specific_points || []),
            ],
            conflict_type: analysis.conflict_type || "similar_requirement",
            resolution_suggestion: analysis.resolution_suggestion || "",
          });

          if (ok) {
            conflicts.push({
              cluster_a_label: cluster.label,
              cluster_b_label: cluster.label,
              conflict_type: analysis.conflict_type,
              description: desc,
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      conflict_count: conflicts.length,
      conflicts,
    });
  } catch (err) {
    console.error("Conflict detection error:", err);
    return res.status(500).json({ error: err.message || "Conflict detection failed" });
  }
}
