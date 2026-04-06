// api/cluster.js
// Vercel serverless function: fetch embeddings, cluster them, label with GPT, save to DB
// v3: Fused semantic (embedding cosine) + syntactic (word + character n-gram) similarity

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { syntacticSimilarity } from "./lib/textSimilarity.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Default blend: ~2/3 semantic, ~1/3 syntactic (overridable via env) */
function fusionWeights() {
  const wSem = parseFloat(process.env.CLUSTER_SEM_WEIGHT || "0.65");
  const wSyn = parseFloat(process.env.CLUSTER_SYN_WEIGHT || "0.35");
  const s = wSem + wSyn;
  if (!s || Number.isNaN(s)) return { wSem: 0.65, wSyn: 0.35 };
  return { wSem: wSem / s, wSyn: wSyn / s };
}

/**
 * Pairwise fused similarity matrix: wSem * cos(emb_i, emb_j) + wSyn * syn(text_i, text_j)
 */
function buildFusedSimilarityMatrix(embeddings, texts) {
  const { wSem, wSyn } = fusionWeights();
  const n = embeddings.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sem = cosineSimilarity(embeddings[i], embeddings[j]);
      const syn = syntacticSimilarity(texts[i], texts[j]);
      const fused = wSem * sem + wSyn * syn;
      matrix[i][j] = matrix[j][i] = fused;
    }
  }
  return matrix;
}

// ── Clustering logic (self-contained for serverless — no shared imports) ──

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

function averageLinkage(clusterA, clusterB, simMatrix) {
  let total = 0, count = 0;
  for (const i of clusterA) {
    for (const j of clusterB) {
      total += simMatrix[i][j];
      count++;
    }
  }
  return count === 0 ? 0 : total / count;
}

function agglomerativeCluster(simMatrix, threshold = 0.75) {
  const n = simMatrix.length;
  let clusters = Array.from({ length: n }, (_, i) => [i]);
  let merged = true;
  while (merged) {
    merged = false;
    let bestSim = -1, bestA = -1, bestB = -1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = averageLinkage(clusters[i], clusters[j], simMatrix);
        if (sim > bestSim) { bestSim = sim; bestA = i; bestB = j; }
      }
    }
    if (bestSim >= threshold && bestA !== -1) {
      const mergedCluster = [...clusters[bestA], ...clusters[bestB]];
      clusters = clusters.filter((_, i) => i !== bestA && i !== bestB);
      clusters.push(mergedCluster);
      merged = true;
    }
  }
  return clusters;
}

// ── NEW: Post-merge small clusters ──
// Absorbs clusters with fewer than minSize submissions into their nearest neighbor.
// This prevents over-splitting where semantically similar submissions end up
// in separate tiny clusters due to minor embedding differences.

function mergeSmallClusters(clusters, simMatrix, minSize = 3) {
  if (clusters.length <= 2) return clusters;

  let changed = true;
  while (changed) {
    changed = false;

    // Find smallest cluster below threshold
    let smallIdx = -1;
    let smallestSize = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].length < minSize && clusters[i].length < smallestSize) {
        smallestSize = clusters[i].length;
        smallIdx = i;
      }
    }

    if (smallIdx === -1) break;
    if (clusters.length <= 2) break;

    // Merge into most similar cluster
    let bestSim = -1, bestTarget = -1;
    for (let i = 0; i < clusters.length; i++) {
      if (i === smallIdx) continue;
      const sim = averageLinkage(clusters[smallIdx], clusters[i], simMatrix);
      if (sim > bestSim) { bestSim = sim; bestTarget = i; }
    }

    if (bestTarget !== -1) {
      clusters[bestTarget] = [...clusters[bestTarget], ...clusters[smallIdx]];
      clusters.splice(smallIdx, 1);
      changed = true;
    }
  }

  return clusters;
}

// ── Silhouette Score Calculation ──

function calculateSilhouetteScore(simMatrix, clusterAssignments) {
  const n = simMatrix.length;
  const uniqueClusters = [...new Set(clusterAssignments)];
  if (uniqueClusters.length <= 1 || uniqueClusters.length >= n) return 0;

  // Sample max 100 for performance
  let sampleIndices = Array.from({ length: n }, (_, i) => i);
  if (n > 100) {
    sampleIndices = sampleIndices.sort(() => Math.random() - 0.5).slice(0, 100);
  }

  const silhouettes = [];

  for (const i of sampleIndices) {
    const currentCluster = clusterAssignments[i];

    // Distance = 1 - fused similarity
    const dist = (i, j) => 1 - simMatrix[i][j];

    const sameCluster = sampleIndices.filter(j => j !== i && clusterAssignments[j] === currentCluster);
    let a_i = 0;
    if (sameCluster.length > 0) {
      for (const j of sameCluster) a_i += dist(i, j);
      a_i /= sameCluster.length;
    }

    let b_i = Infinity;
    for (const other of uniqueClusters) {
      if (other === currentCluster) continue;
      const otherPoints = sampleIndices.filter(j => clusterAssignments[j] === other);
      if (otherPoints.length === 0) continue;
      let avgDist = 0;
      for (const j of otherPoints) avgDist += dist(i, j);
      avgDist /= otherPoints.length;
      b_i = Math.min(b_i, avgDist);
    }

    if (b_i === Infinity) {
      silhouettes.push(0);
    } else {
      const maxDist = Math.max(a_i, b_i);
      silhouettes.push(maxDist === 0 ? 0 : (b_i - a_i) / maxDist);
    }
  }

  return silhouettes.length > 0 ? silhouettes.reduce((sum, s) => sum + s, 0) / silhouettes.length : 0;
}

function interpretSilhouetteScore(score) {
  if (score < 0.25) return "poor";
  if (score < 0.50) return "fair";
  if (score < 0.75) return "good";
  return "excellent";
}

// ── NEW: Adaptive Threshold Selection ──
// Instead of a hardcoded threshold, we test multiple values and pick the one
// that maximizes silhouette score while keeping cluster count reasonable.
// This makes the algorithm self-tuning — different projects with different
// submission patterns will automatically get different thresholds.

function findOptimalThreshold(simMatrix) {
  const n = simMatrix.length;
  const thresholds = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85];
  const minClusters = 3;
  const maxClusters = Math.max(Math.floor(n / 3), 5);

  const analysis = [];
  let bestScore = -Infinity;
  let bestThreshold = 0.70; // sensible fallback

  for (const t of thresholds) {
    try {
      const clusters = agglomerativeCluster(simMatrix, t);
      const clusterCount = clusters.length;

      // Build assignments
      const assignments = new Array(n);
      clusters.forEach((group, idx) => {
        group.forEach(i => { assignments[i] = idx; });
      });

      const silhouette = calculateSilhouetteScore(simMatrix, assignments);

      // Hard penalty for too few clusters
      let penalty = 0;
      if (clusterCount < minClusters) penalty += 0.5 * (minClusters - clusterCount);

      // Soft penalty for small clusters (they'll be merged, but many = threshold too high)
      const smallClusters = clusters.filter(c => c.length < 3).length;
      const smallRatio = smallClusters / Math.max(clusterCount, 1);
      penalty += 0.1 * smallRatio;

      // Bonus for more clusters (merge step cleans up small ones)
      const clusterBonus = 0.01 * Math.min(clusterCount, maxClusters);

      const adjustedScore = silhouette - penalty + clusterBonus;

      analysis.push({
        threshold: t,
        cluster_count: clusterCount,
        silhouette_score: Math.round(silhouette * 1000) / 1000,
        small_clusters: smallClusters,
        adjusted_score: Math.round(adjustedScore * 1000) / 1000
      });

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestThreshold = t;
      }
    } catch (e) {
      analysis.push({ threshold: t, error: e.message });
    }
  }

  return { threshold: bestThreshold, analysis };
}

// ── GPT cluster labeling ──

async function labelCluster(submissions) {
  const texts = submissions.map((s, i) => `${i + 1}. "${s.raw_text}"`).join("\n");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a requirements analyst. Given a group of stakeholder submissions, produce: (1) a short label (3-5 words), (2) a one-sentence summary of the common theme. Respond in JSON: { label: string, summary: string }",
      },
      {
        role: "user",
        content: `These submissions were grouped using fused semantic (meaning) and syntactic (wording) similarity:\n\n${texts}\n\nProvide a label and summary for this cluster.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 150,
  });
  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { label: "Unnamed Cluster", summary: "A group of related submissions." };
  }
}

// ── Main handler ──

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { project_id } = req.body;
  if (!project_id) {
    return res.status(400).json({ error: "project_id is required" });
  }

  try {
    // 1. Fetch all submissions with embeddings
    const { data: submissions, error: fetchError } = await supabase
      .from("stakeholder_submissions")
      .select("id, raw_text, embedding, stakeholder_role")
      .eq("project_id", project_id)
      .not("embedding", "is", null);

    if (fetchError) throw fetchError;

    if (!submissions || submissions.length === 0) {
      const { count: totalSubs } = await supabase
        .from("stakeholder_submissions")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id);
      if (totalSubs > 0) {
        return res.status(400).json({
          error:
            "Embeddings are not ready yet. Wait a minute after submitting, then try again.",
        });
      }
      return res.status(400).json({ error: "No submissions to cluster." });
    }

    // Single submission: one cluster (agglomerative clustering needs n >= 2)
    if (submissions.length === 1) {
      const s = submissions[0];
      const embeddings = [
        typeof s.embedding === "string" ? JSON.parse(s.embedding) : s.embedding,
      ];

      await supabase
        .from("stakeholder_submissions")
        .update({ cluster_id: null })
        .eq("project_id", project_id);
      await supabase.from("requirement_clusters").delete().eq("project_id", project_id);

      const { label, summary } = await labelCluster([s]);

      const { data: cluster, error: clusterError } = await supabase
        .from("requirement_clusters")
        .insert({
          project_id,
          label,
          summary,
          submission_count: 1,
        })
        .select()
        .single();

      if (clusterError) throw clusterError;

      await supabase
        .from("stakeholder_submissions")
        .update({ cluster_id: cluster.id })
        .eq("id", s.id);

      return res.status(200).json({
        success: true,
        cluster_count: 1,
        quality_metrics: {
          silhouette_score: 0,
          interpretation: "single_group",
          scale: "Silhouette is not meaningful for a single submission.",
          optimal_threshold: null,
          threshold_analysis: [],
          small_clusters_merged: 0,
          pre_merge_cluster_count: 1,
          post_merge_cluster_count: 1,
        },
        clusters: [{ ...cluster, submissions: [s] }],
      });
    }

    // 2. Parse embeddings + build fused semantic + syntactic similarity matrix
    const embeddings = submissions.map((s) =>
      typeof s.embedding === "string" ? JSON.parse(s.embedding) : s.embedding
    );
    const texts = submissions.map((s) => s.raw_text || "");
    const simMatrix = buildFusedSimilarityMatrix(embeddings, texts);
    const { wSem, wSyn } = fusionWeights();

    // 3. ADAPTIVE THRESHOLD on fused similarity
    const { threshold: optimalThreshold, analysis: thresholdAnalysis } = findOptimalThreshold(simMatrix);

    // 4. Run clustering with the optimal threshold
    let clusters = agglomerativeCluster(simMatrix, optimalThreshold);

    // 5. POST-MERGE: Absorb tiny clusters into nearest neighbor
    const dynamicMinSize = Math.max(2, Math.floor(submissions.length * 0.05));
    const preMergeCount = clusters.length;
    clusters = mergeSmallClusters(clusters, simMatrix, dynamicMinSize);
    const postMergeCount = clusters.length;

    // 6. Delete existing clusters for this project
    await supabase
      .from("stakeholder_submissions")
      .update({ cluster_id: null })
      .eq("project_id", project_id);
    await supabase.from("requirement_clusters").delete().eq("project_id", project_id);

    // 7. Calculate final silhouette score
    const clusterAssignments = new Array(submissions.length);
    clusters.forEach((group, clusterIndex) => {
      group.forEach(submissionIndex => {
        clusterAssignments[submissionIndex] = clusterIndex;
      });
    });
    const silhouetteScore = calculateSilhouetteScore(simMatrix, clusterAssignments);
    const interpretation = interpretSilhouetteScore(silhouetteScore);

    // 8. Label each cluster with GPT and save
    const savedClusters = [];

    for (const group of clusters) {
      const groupSubmissions = group.map((i) => submissions[i]);
      const { label, summary } = await labelCluster(groupSubmissions);

      const { data: cluster, error: clusterError } = await supabase
        .from("requirement_clusters")
        .insert({
          project_id,
          label,
          summary,
          submission_count: group.length,
        })
        .select()
        .single();

      if (clusterError) throw clusterError;

      const submissionIds = groupSubmissions.map(s => s.id);
      await supabase
        .from("stakeholder_submissions")
        .update({ cluster_id: cluster.id })
        .in("id", submissionIds);

      savedClusters.push({ ...cluster, submissions: groupSubmissions });
    }

    return res.status(200).json({
      success: true,
      cluster_count: savedClusters.length,
      quality_metrics: {
        silhouette_score: Math.round(silhouetteScore * 100) / 100,
        interpretation,
        scale: "poor (<0.25) | fair (0.25-0.50) | good (0.50-0.75) | excellent (>0.75)",
        optimal_threshold: optimalThreshold,
        threshold_analysis: thresholdAnalysis,
        small_clusters_merged: preMergeCount - postMergeCount,
        pre_merge_cluster_count: preMergeCount,
        post_merge_cluster_count: postMergeCount,
        similarity_fusion: {
          semantic_weight: wSem,
          syntactic_weight: wSyn,
          description:
            "Pairwise similarity = w_sem × cosine(embedding) + w_syn × (word Jaccard + bigram Jaccard).",
        },
      },
      clusters: savedClusters,
    });
  } catch (err) {
    console.error("Cluster error:", err);
    return res.status(500).json({ error: err.message || "Clustering failed" });
  }
}
