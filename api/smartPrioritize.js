// api/smartPrioritize.js
// Smart Prioritization — AI-assisted, data-driven, minimal user input
// Combines: submission volume, stakeholder consensus (opinion mining), 
// conflict severity, NFR coverage, and user-defined strategic weight
// into a single composite priority score per cluster.

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Scoring Functions ──

// 1. Stakeholder Demand Score (0-1)
// More submissions = more stakeholder interest = higher demand
function calcDemandScore(cluster, maxSubmissions) {
  return maxSubmissions > 0 ? cluster.submission_count / maxSubmissions : 0;
}

// 2. Consensus Score (0-1)
// Low divergence = high consensus = easier to implement = higher score
// High divergence = controversy = needs resolution first = lower score
function calcConsensusScore(divergenceScore) {
  if (divergenceScore === null || divergenceScore === undefined) return 0.5; // neutral if no data
  return 1 - divergenceScore; // invert: low divergence = high consensus
}

// 3. Conflict Impact Score (0-1)
// Clusters involved in high-severity conflicts get BOOSTED (not penalized)
// because conflicts indicate critical decision points that need prioritization
function calcConflictScore(clusterId, conflicts) {
  const related = conflicts.filter(
    c => c.cluster_a_id === clusterId || c.cluster_b_id === clusterId
  );
  if (related.length === 0) return 0.3; // neutral baseline for no conflicts
  
  const severityMap = { high: 1.0, medium: 0.6, low: 0.3 };
  const maxSeverity = Math.max(...related.map(c => severityMap[c.severity] || 0.3));
  const unresolvedCount = related.filter(c => !c.resolved).length;
  
  // High severity + unresolved = high priority to address
  return Math.min(1, maxSeverity * 0.7 + (unresolvedCount * 0.15));
}

// 4. NFR Coverage Score (0-1)
// Clusters that have generated NFRs (especially approved ones) show maturity
function calcNfrScore(clusterId, nfrs, clusterProjectId) {
  // NFRs are project-level, not cluster-level. Score based on whether
  // the cluster's domain has NFR coverage
  const approvedCount = nfrs.filter(n => n.status === 'approved').length;
  const totalCount = nfrs.length;
  if (totalCount === 0) return 0.5; // neutral if no NFRs yet
  return Math.min(1, 0.3 + (approvedCount / Math.max(totalCount, 1)) * 0.7);
}

// 5. AI Feasibility & Value Assessment
async function getAiAssessment(clusters, projectDescription) {
  const clusterSummaries = clusters.map((c, i) => 
    `${i + 1}. "${c.label}" (${c.submission_count} submissions) — ${c.summary || 'No summary'}`
  ).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a requirements engineering expert analyzing requirement clusters for a transit system project. 
For each cluster, assess:
- business_value (0.0-1.0): How important is this to end users and project success?
- feasibility (0.0-1.0): How technically feasible is this to implement in an MVP?
- urgency (0.0-1.0): How time-critical is this? (safety/core functionality = high, nice-to-haves = low)

Return JSON array: [{ "index": 1, "business_value": 0.8, "feasibility": 0.7, "urgency": 0.9, "reasoning": "brief reason" }, ...]`
        },
        {
          role: "user",
          content: `Project: Smart Transit System — a collaborative platform for public transportation requirements engineering.\n\nClusters:\n${clusterSummaries}\n\nAssess each cluster.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.3
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.assessments || parsed;
  } catch (err) {
    console.error("AI assessment error:", err);
    return null;
  }
}

// ── Composite Score Calculation ──

function calculateCompositeScore(scores, weights) {
  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (scores[key] !== undefined && scores[key] !== null) {
      total += scores[key] * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? total / weightSum * 10 : 5; // Scale to 0-10
}

// ── Main Handler ──

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { project_id, strategy } = req.body;
  // strategy: "balanced" | "stakeholder_driven" | "feasibility_first" | "risk_aware" | "custom"
  // custom_weights: optional { demand, consensus, conflict, value, feasibility, urgency }

  if (!project_id) {
    return res.status(400).json({ error: "project_id is required" });
  }

  const strategyMode = strategy || "balanced";

  // Pre-defined weight profiles
  const WEIGHT_PROFILES = {
    balanced: {
      demand: 0.20,       // Stakeholder submission volume
      consensus: 0.15,    // Opinion mining consensus
      conflict: 0.10,     // Conflict severity
      value: 0.25,        // AI-assessed business value
      feasibility: 0.15,  // AI-assessed feasibility
      urgency: 0.15       // AI-assessed urgency
    },
    stakeholder_driven: {
      demand: 0.35,
      consensus: 0.25,
      conflict: 0.10,
      value: 0.15,
      feasibility: 0.05,
      urgency: 0.10
    },
    feasibility_first: {
      demand: 0.10,
      consensus: 0.10,
      conflict: 0.05,
      value: 0.20,
      feasibility: 0.40,
      urgency: 0.15
    },
    risk_aware: {
      demand: 0.10,
      consensus: 0.25,
      conflict: 0.25,
      value: 0.15,
      feasibility: 0.10,
      urgency: 0.15
    }
  };

  const weights = req.body.custom_weights || WEIGHT_PROFILES[strategyMode] || WEIGHT_PROFILES.balanced;

  try {
    // 1. Fetch all data in parallel
    const [
      { data: clusters, error: clustersError },
      { data: divergenceScores },
      { data: conflicts },
      { data: nfrs },
      { data: project }
    ] = await Promise.all([
      supabase.from("requirement_clusters").select("*").eq("project_id", project_id).order("submission_count", { ascending: false }),
      supabase.from("cluster_divergence_scores").select("*").eq("project_id", project_id),
      supabase.from("cluster_conflicts").select("*").eq("project_id", project_id),
      supabase.from("project_nfrs").select("*").eq("project_id", project_id),
      supabase.from("projects").select("name, description").eq("id", project_id).single()
    ]);

    if (clustersError) throw clustersError;
    if (!clusters || clusters.length === 0) {
      return res.status(400).json({ error: "No clusters found. Run clustering first." });
    }

    // 2. Build lookup maps
    const divergenceMap = {};
    (divergenceScores || []).forEach(d => { divergenceMap[d.cluster_id] = d.divergence_score; });

    const maxSubmissions = Math.max(...clusters.map(c => c.submission_count));

    // 3. Get AI assessment
    const aiAssessments = await getAiAssessment(clusters, project?.description || '');
    const aiMap = {};
    if (aiAssessments && Array.isArray(aiAssessments)) {
      aiAssessments.forEach(a => {
        aiMap[a.index - 1] = a; // 0-indexed
      });
    }

    // 4. Calculate scores for each cluster
    const results = clusters.map((cluster, idx) => {
      const ai = aiMap[idx] || { business_value: 0.5, feasibility: 0.5, urgency: 0.5, reasoning: "No AI assessment" };
      
      const scores = {
        demand: calcDemandScore(cluster, maxSubmissions),
        consensus: calcConsensusScore(divergenceMap[cluster.id]),
        conflict: calcConflictScore(cluster.id, conflicts || []),
        value: ai.business_value,
        feasibility: ai.feasibility,
        urgency: ai.urgency
      };

      const compositeScore = calculateCompositeScore(scores, weights);

      return {
        cluster_id: cluster.id,
        cluster_label: cluster.label || `Cluster ${idx + 1}`,
        cluster_summary: cluster.summary,
        submission_count: cluster.submission_count,
        composite_score: Math.round(compositeScore * 100) / 100,
        scores: {
          demand: Math.round(scores.demand * 100) / 100,
          consensus: Math.round(scores.consensus * 100) / 100,
          conflict: Math.round(scores.conflict * 100) / 100,
          value: Math.round(scores.value * 100) / 100,
          feasibility: Math.round(scores.feasibility * 100) / 100,
          urgency: Math.round(scores.urgency * 100) / 100
        },
        ai_reasoning: ai.reasoning || ""
      };
    });

    // 5. Sort by composite score
    results.sort((a, b) => b.composite_score - a.composite_score);

    // 6. Assign ranks
    results.forEach((r, i) => { r.rank = i + 1; });

    // 7. Save to prioritization_results table 
    // Renamed from ahp_results via migration 005_rename_ahp_to_prioritization.sql






    const toInsert = results.map(r => ({
      project_id,
      cluster_id: r.cluster_id,
      priority_score: r.composite_score,
      rank: r.rank,
      consistency_ratio: 0 // Set to 0 - not applicable for smart prioritization (was used for AHP validation)
    }));

    await supabase.from("prioritization_results").insert(toInsert);

    return res.status(200).json({
      success: true,
      strategy: strategyMode,
      weights,
      total_clusters: results.length,
      results
    });

  } catch (error) {
    console.error("Smart prioritization error:", error);
    return res.status(500).json({ error: error.message || "Prioritization failed" });
  }
}
