// api/generateNfrs.js
// Vercel serverless function: Generate NFRs using GPT-4o-mini based on project and clusters

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
    // 1. Fetch project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, description, domain")
      .eq("id", project_id)
      .single();

    if (projectError) throw projectError;

    // 2. Fetch all clusters for this project
    const { data: clusters, error: clustersError } = await supabase
      .from("requirement_clusters")
      .select("id, label, summary")
      .eq("project_id", project_id)
      .order("submission_count", { ascending: false });

    if (clustersError) throw clustersError;

    // 3. Fetch representative submissions for each cluster (up to 5 per cluster)
    const clustersWithSubmissions = await Promise.all(
      clusters.map(async (cluster) => {
        const { data: submissions, error: submissionsError } = await supabase
          .from("stakeholder_submissions")
          .select("raw_text, stakeholder_role")
          .eq("cluster_id", cluster.id)
          .limit(5);

        if (submissionsError) {
          console.warn(`Failed to fetch submissions for cluster ${cluster.id}:`, submissionsError);
          return { ...cluster, submissions: [] };
        }

        return { ...cluster, submissions: submissions || [] };
      })
    );

    // 4. Build context for GPT with actual stakeholder submissions
    const projectContext = `
Project: ${project.name}
Domain: ${project.domain || "General"}
Description: ${project.description || "Not specified"}

Requirement Clusters with Stakeholder Input:
${clustersWithSubmissions.map((cluster, i) => {
  let clusterText = `${i + 1}. ${cluster.label}: ${cluster.summary}`;
  
  if (cluster.submissions && cluster.submissions.length > 0) {
    clusterText += "\n   Stakeholder submissions:";
    cluster.submissions.forEach((submission, j) => {
      clusterText += `\n   - [${submission.stakeholder_role}]: "${submission.raw_text}"`;
    });
  }
  
  return clusterText;
}).join("\n\n")}
    `.trim();

    // 5. Call GPT-4o-mini to generate NFRs
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a requirements analyst specializing in non-functional requirements (NFRs). 

Based on a project description, its functional requirement clusters, AND specific stakeholder submissions, generate 5-10 relevant NFRs using the ISO/IEC 25010 quality model categories:

- Performance (response time, throughput, resource utilization)
- Reliability (fault tolerance, recoverability, maturity)
- Security (confidentiality, integrity, authenticity, accountability)
- Usability (learnability, operability, accessibility, user error protection)
- Compatibility (interoperability, coexistence)
- Maintainability (modularity, reusability, analyzability, modifiability, testability)
- Portability (adaptability, installability, replaceability)
- Functional Suitability (functional completeness, correctness, appropriateness)

IMPORTANT: Ground your NFRs in the actual stakeholder input provided. Reference specific stakeholder concerns, use cases, or requirements when generating NFRs. This ensures NFRs are defensible and traceable back to real stakeholder needs.

For each NFR, provide:
1. category - one of the ISO 25010 categories above
2. description - a specific, measurable NFR statement
3. rationale - why this NFR is important, referencing specific stakeholder concerns or submissions where applicable

Return valid JSON in this format:
{
  "nfrs": [
    {
      "category": "Performance", 
      "description": "The system shall respond to user queries within 2 seconds under normal load",
      "rationale": "Based on end-user submissions emphasizing quick access to information, fast response times are critical for user satisfaction"
    }
  ]
}

Focus on the most relevant NFRs based on the project domain, functional requirements, AND stakeholder input. Make descriptions specific and measurable where possible.`
        },
        {
          role: "user", 
          content: projectContext
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.7
    });

    let generatedNfrs;
    try {
      generatedNfrs = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      throw new Error("Failed to parse GPT response");
    }

    if (!generatedNfrs.nfrs || !Array.isArray(generatedNfrs.nfrs)) {
      throw new Error("Invalid NFR format from GPT");
    }

    // 6. Save NFRs to database
    const nfrsToInsert = generatedNfrs.nfrs.map(nfr => ({
      project_id,
      category: nfr.category,
      description: nfr.description,
      rationale: nfr.rationale,
      status: 'pending'
    }));

    const { data: savedNfrs, error: insertError } = await supabase
      .from("project_nfrs")
      .insert(nfrsToInsert)
      .select();

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      generated_count: savedNfrs.length,
      nfrs: savedNfrs
    });

  } catch (error) {
    console.error("Generate NFRs error:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to generate NFRs" 
    });
  }
}