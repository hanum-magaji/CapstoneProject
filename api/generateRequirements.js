/**
 * POST /api/generateRequirements
 * Generates stakeholder-style requirement texts from project context and inserts them
 * into stakeholder_submissions, then runs the same NLP pipeline as /api/submit.
 */
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { processSubmission } from "./submit.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_COUNT = 25;

function parseJsonArray(raw) {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Database not configured." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not set." });
  }

  const { project_id, count = 5, name, description, domain } = req.body || {};

  if (!project_id) {
    return res.status(400).json({ error: "Missing project_id" });
  }

  let n = parseInt(String(count), 10);
  if (Number.isNaN(n) || n < 1) n = 5;
  if (n > MAX_COUNT) n = MAX_COUNT;

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name, description, domain")
    .eq("id", project_id)
    .single();

  if (projErr || !project) {
    return res.status(404).json({ error: "Project not found." });
  }

  const projectName = name || project.name || "Project";
  const projectDesc = description ?? project.description ?? "";
  const projectDomain = domain ?? project.domain ?? "";

  const prompt = `You are a requirements analyst for smart-city and civic software projects.

Project name: ${projectName}
Domain: ${projectDomain || "general"}
Description:
${projectDesc || "(no description provided)"}

Return ONLY a JSON array of exactly ${n} objects. Each object must be:
{ "text": "<single clear requirement statement in English, testable, starting with The system shall / Users must be able to / The platform should ... as appropriate>" }

Requirements must be distinct, realistic for this project, and grounded in the description. No duplicate ideas. No markdown, no commentary outside the JSON.`;

  let items;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.55,
      max_tokens: 4096,
    });
    const raw = completion.choices[0]?.message?.content || "[]";
    items = parseJsonArray(raw);
  } catch (e) {
    console.error("generateRequirements AI error:", e);
    return res.status(500).json({ error: e?.message || "Failed to generate requirements" });
  }

  const texts = items
    .map((item) => (typeof item === "string" ? item : item?.text))
    .filter((t) => typeof t === "string" && t.trim().length >= 10)
    .slice(0, n);

  if (texts.length === 0) {
    return res.status(500).json({ error: "Model returned no valid requirements." });
  }

  const created = [];

  for (const rawText of texts) {
    const trimmed = rawText.trim();
    let embedding = null;
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: trimmed.slice(0, 8000),
      });
      embedding = embeddingResponse.data[0].embedding;
    } catch (e) {
      console.error("Embedding failed:", e.message);
    }

    const insertData = {
      project_id,
      raw_text: trimmed,
      stakeholder_name: "AI Assistant",
      stakeholder_role: "Generated",
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
      console.error("Insert failed:", insertError);
      continue;
    }

    created.push({ id: submission.id, created_at: submission.created_at });

    processSubmission({
      submissionId: submission.id,
      projectId: project_id,
      rawText: trimmed,
      projectName,
      projectDescription: projectDesc,
    }).catch((err) => console.error("[generateRequirements] processSubmission:", err));
  }

  return res.status(200).json({
    success: true,
    count: created.length,
    ids: created.map((c) => c.id),
  });
}
