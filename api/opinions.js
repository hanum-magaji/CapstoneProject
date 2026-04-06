// api/opinions.js
// Vercel serverless function: Analyze clusters for divergent viewpoints using GPT-4o-mini

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
    // 1. Fetch all clusters with their submissions for this project
    const { data: clusters, error: clustersError } = await supabase
      .from("requirement_clusters")
      .select("id, label, summary, submission_count")
      .eq("project_id", project_id)
      .gte("submission_count", 3); // Only analyze clusters with 3+ submissions

    if (clustersError) throw clustersError;

    // 2. Clear existing opinions and divergence scores for this project
    await supabase
      .from("cluster_opinions")
      .delete()
      .eq("project_id", project_id);

    await supabase
      .from("cluster_divergence_scores")
      .delete()
      .eq("project_id", project_id);

    const analysisResults = [];

    // 3. For each cluster, fetch submissions and analyze viewpoints
    for (const cluster of clusters) {
      // Get submissions for this cluster
      const { data: submissions, error: submissionsError } = await supabase
        .from("stakeholder_submissions")
        .select("id, raw_text, stakeholder_role")
        .eq("cluster_id", cluster.id);

      if (submissionsError) {
        console.error(`Error fetching submissions for cluster ${cluster.id}:`, submissionsError);
        continue;
      }
      
      if (submissions.length < 3) continue;

      // Build context for GPT
      const submissionsText = submissions
        .map((s, i) => `Submission ${i + 1} [${s.stakeholder_role || 'Unknown'}]: "${s.raw_text}"`)
        .join("\n\n");

      const clusterContext = `
Cluster: ${cluster.label}
Summary: ${cluster.summary}

Stakeholder Submissions:
${submissionsText}
      `.trim();

      // 4. Call GPT-4o-mini to analyze viewpoints
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are analyzing stakeholder submissions within a requirement cluster to find different viewpoints and measure consensus.

Your task:
1. Identify 2-5 distinct opinion camps/viewpoints within the submissions
2. For each viewpoint, determine which submissions belong to it
3. Classify each viewpoint's stance as: supportive, opposed, neutral, or alternative
4. Rate overall divergence from 0.0 (everyone agrees) to 1.0 (completely polarized)

Return JSON in this exact format:
{
  "viewpoints": [
    {
      "label": "Strong Support for X",
      "summary": "Description of this viewpoint's position",
      "stance": "supportive",
      "submission_indexes": [0, 2, 4]
    }
  ],
  "divergence_score": 0.3,
  "analysis_notes": "Brief explanation of the divergence level"
}

Guidelines:
- submission_indexes should reference the 0-based index of submissions
- Divergence scoring: 0.0-0.2 = strong consensus, 0.2-0.5 = moderate disagreement, 0.5-0.8 = significant polarization, 0.8-1.0 = extreme polarization
- Look for differences in priorities, implementation approaches, scope, or fundamental disagreement about the requirement's value
- If submissions are very similar, create fewer viewpoints and score divergence low`
            },
            {
              role: "user",
              content: clusterContext
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000,
          temperature: 0.5
        });

        let analysis;
        try {
          analysis = JSON.parse(response.choices[0].message.content);
        } catch (parseError) {
          console.error(`Parse error for cluster ${cluster.id}:`, parseError);
          continue;
        }

        if (!analysis.viewpoints || !Array.isArray(analysis.viewpoints)) {
          console.error(`Invalid analysis format for cluster ${cluster.id}`);
          continue;
        }

        // 5. Save viewpoints to database
        const opinionsToInsert = analysis.viewpoints.map(viewpoint => {
          const submissionIds = viewpoint.submission_indexes?.map(idx => 
            submissions[idx]?.id
          ).filter(id => id) || [];

          return {
            cluster_id: cluster.id,
            project_id: project_id,
            viewpoint_label: viewpoint.label,
            viewpoint_summary: viewpoint.summary,
            stance: viewpoint.stance,
            submission_ids: JSON.stringify(submissionIds),
            stakeholder_count: submissionIds.length
          };
        });

        const { data: savedOpinions, error: opinionsError } = await supabase
          .from("cluster_opinions")
          .insert(opinionsToInsert)
          .select();

        if (opinionsError) {
          console.error(`Error saving opinions for cluster ${cluster.id}:`, opinionsError);
          continue;
        }

        // 6. Save divergence score
        const { error: divergenceError } = await supabase
          .from("cluster_divergence_scores")
          .insert({
            cluster_id: cluster.id,
            project_id: project_id,
            divergence_score: Math.max(0, Math.min(1, analysis.divergence_score || 0)),
            opinion_count: analysis.viewpoints.length
          });

        if (divergenceError) {
          console.error(`Error saving divergence score for cluster ${cluster.id}:`, divergenceError);
          continue;
        }

        analysisResults.push({
          cluster_id: cluster.id,
          cluster_label: cluster.label,
          viewpoints: savedOpinions,
          divergence_score: analysis.divergence_score,
          analysis_notes: analysis.analysis_notes
        });

      } catch (gptError) {
        console.error(`GPT error for cluster ${cluster.id}:`, gptError);
        continue;
      }
    }

    return res.status(200).json({
      success: true,
      analyzed_clusters: analysisResults.length,
      total_clusters: clusters.length,
      results: analysisResults
    });

  } catch (error) {
    console.error("Opinion mining error:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to analyze opinions" 
    });
  }
}