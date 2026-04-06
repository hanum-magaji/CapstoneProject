// api/relabelClusters.js
// Re-labels clusters that have empty/null labels by looking at their submissions

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ error: "project_id is required" });
  }

  try {
    // Get clusters with missing labels
    const { data: clusters, error: clustersError } = await supabase
      .from("requirement_clusters")
      .select("id, label, summary, submission_count")
      .eq("project_id", project_id)
      .or("label.is.null,label.eq.");

    if (clustersError) throw clustersError;

    if (!clusters || clusters.length === 0) {
      return res.status(200).json({ success: true, relabeled: 0, message: "All clusters already have labels." });
    }

    const results = [];

    for (const cluster of clusters) {
      const { data: submissions } = await supabase
        .from("stakeholder_submissions")
        .select("raw_text, stakeholder_role")
        .eq("cluster_id", cluster.id);

      if (!submissions || submissions.length === 0) continue;

      const texts = submissions.map((s, i) => `${i + 1}. "${s.raw_text}"`).join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a requirements analyst. Given a group of stakeholder submissions, produce: (1) a short label (3-5 words), (2) a one-sentence summary of the common theme. Respond in JSON: { \"label\": \"string\", \"summary\": \"string\" }",
          },
          {
            role: "user",
            content: `These submissions were grouped together by semantic similarity:\n\n${texts}\n\nProvide a label and summary for this cluster.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 150,
      });

      let parsed;
      try {
        parsed = JSON.parse(response.choices[0].message.content);
      } catch {
        parsed = { label: "Unnamed Cluster", summary: "A group of related submissions." };
      }

      const { error: updateError } = await supabase
        .from("requirement_clusters")
        .update({ label: parsed.label, summary: parsed.summary })
        .eq("id", cluster.id);

      if (!updateError) {
        results.push({ id: cluster.id, label: parsed.label, summary: parsed.summary });
      }
    }

    return res.status(200).json({ success: true, relabeled: results.length, results });
  } catch (error) {
    console.error("Relabel error:", error);
    return res.status(500).json({ error: error.message || "Failed to relabel clusters" });
  }
}
