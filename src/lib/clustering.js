// src/lib/clustering.js
// Pure JS clustering utilities — cosine similarity + agglomerative clustering
// v2: Added adaptive thresholding, small cluster merging, Ward's linkage option

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Build a similarity matrix for an array of embeddings.
 * Returns a 2D array where matrix[i][j] = cosine similarity between i and j.
 */
export function buildSimilarityMatrix(embeddings) {
  const n = embeddings.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const sim = i === j ? 1 : cosineSimilarity(embeddings[i], embeddings[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  return matrix;
}

/**
 * Average linkage: average similarity between all pairs across two clusters.
 */
export function averageLinkage(clusterA, clusterB, embeddings) {
  let total = 0;
  let count = 0;
  for (const i of clusterA) {
    for (const j of clusterB) {
      total += cosineSimilarity(embeddings[i], embeddings[j]);
      count++;
    }
  }
  return count === 0 ? 0 : total / count;
}

/**
 * Ward's linkage: measures the increase in total within-cluster variance
 * when merging two clusters. Tends to produce more balanced, equally-sized clusters.
 * 
 * Returns a similarity score (higher = more similar = should merge first).
 * Uses inverse of Ward's distance so it's compatible with our threshold-based merging.
 */
export function wardLinkage(clusterA, clusterB, embeddings) {
  const dim = embeddings[0].length;
  
  // Compute centroids
  const centroidA = new Array(dim).fill(0);
  const centroidB = new Array(dim).fill(0);
  
  for (const i of clusterA)
    for (let d = 0; d < dim; d++) centroidA[d] += embeddings[i][d];
  for (let d = 0; d < dim; d++) centroidA[d] /= clusterA.length;
  
  for (const i of clusterB)
    for (let d = 0; d < dim; d++) centroidB[d] += embeddings[i][d];
  for (let d = 0; d < dim; d++) centroidB[d] /= clusterB.length;
  
  // Ward's criterion: weighted squared Euclidean distance between centroids
  const nA = clusterA.length, nB = clusterB.length;
  let sqDist = 0;
  for (let d = 0; d < dim; d++)
    sqDist += (centroidA[d] - centroidB[d]) ** 2;
  
  const wardDist = (nA * nB / (nA + nB)) * sqDist;
  
  // Convert distance to similarity (higher = more similar)
  // Use inverse so threshold-based merging still works
  return 1 / (1 + wardDist);
}

/**
 * Agglomerative clustering with configurable linkage.
 * 
 * @param {number[][]} embeddings - Array of embedding vectors
 * @param {number} threshold - Minimum similarity to merge (0.0 - 1.0)
 * @param {string} linkage - "average" or "ward"
 * @returns {number[][]} Array of cluster arrays, each containing submission indexes
 */
export function agglomerativeCluster(embeddings, threshold = 0.75, linkage = "average") {
  const n = embeddings.length;
  let clusters = embeddings.map((_, i) => [i]);

  const linkageFn = linkage === "ward" ? wardLinkage : averageLinkage;

  let merged = true;
  while (merged) {
    merged = false;
    let bestSim = -1;
    let bestA = -1;
    let bestB = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = linkageFn(clusters[i], clusters[j], embeddings);
        if (sim > bestSim) {
          bestSim = sim;
          bestA = i;
          bestB = j;
        }
      }
    }

    if (bestSim >= threshold && bestA !== -1) {
      const merged_cluster = [...clusters[bestA], ...clusters[bestB]];
      clusters = clusters.filter((_, i) => i !== bestA && i !== bestB);
      clusters.push(merged_cluster);
      merged = true;
    }
  }

  return clusters;
}

/**
 * Merge small clusters into their nearest neighbor.
 * Prevents over-splitting by absorbing clusters below minSize.
 * 
 * @param {number[][]} clusters - Array of cluster arrays
 * @param {number[][]} embeddings - Original embeddings
 * @param {number} minSize - Minimum cluster size (default 3)
 * @returns {number[][]} Clusters with small ones merged
 */
export function mergeSmallClusters(clusters, embeddings, minSize = 3) {
  // Don't merge if we'd end up with only 1 cluster
  if (clusters.length <= 2) return clusters;

  let changed = true;
  while (changed) {
    changed = false;
    
    // Find smallest cluster below minSize
    let smallIdx = -1;
    let smallestSize = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].length < minSize && clusters[i].length < smallestSize) {
        smallestSize = clusters[i].length;
        smallIdx = i;
      }
    }
    
    if (smallIdx === -1) break; // No small clusters left
    if (clusters.length <= 2) break; // Don't merge below 2 clusters

    // Find the most similar larger cluster
    let bestSim = -1;
    let bestTarget = -1;
    for (let i = 0; i < clusters.length; i++) {
      if (i === smallIdx) continue;
      const sim = averageLinkage(clusters[smallIdx], clusters[i], embeddings);
      if (sim > bestSim) {
        bestSim = sim;
        bestTarget = i;
      }
    }

    if (bestTarget !== -1) {
      clusters[bestTarget] = [...clusters[bestTarget], ...clusters[smallIdx]];
      clusters.splice(smallIdx, 1);
      changed = true;
    }
  }

  return clusters;
}

/**
 * Calculate silhouette score for a clustering result.
 * Measures how well each point fits in its cluster vs. the nearest other cluster.
 * Range: -1 (wrong cluster) to 1 (perfect clustering).
 * 
 * @param {number[][]} embeddings - Embedding vectors
 * @param {number[]} assignments - Cluster assignment for each embedding
 * @returns {number} Average silhouette score
 */
export function calculateSilhouetteScore(embeddings, assignments) {
  const n = embeddings.length;
  const uniqueClusters = [...new Set(assignments)];
  if (uniqueClusters.length <= 1 || uniqueClusters.length >= n) return 0;

  // Sample for performance (max 100 points)
  let indices = Array.from({ length: n }, (_, i) => i);
  if (n > 100) {
    indices = indices.sort(() => Math.random() - 0.5).slice(0, 100);
  }

  const silhouettes = [];

  for (const i of indices) {
    const myCluster = assignments[i];

    // a(i) = avg distance to same-cluster points
    const sameCluster = indices.filter(j => j !== i && assignments[j] === myCluster);
    let a_i = 0;
    if (sameCluster.length > 0) {
      for (const j of sameCluster) a_i += 1 - cosineSimilarity(embeddings[i], embeddings[j]);
      a_i /= sameCluster.length;
    }

    // b(i) = min avg distance to any other cluster's points
    let b_i = Infinity;
    for (const other of uniqueClusters) {
      if (other === myCluster) continue;
      const otherPoints = indices.filter(j => assignments[j] === other);
      if (otherPoints.length === 0) continue;
      let avgDist = 0;
      for (const j of otherPoints) avgDist += 1 - cosineSimilarity(embeddings[i], embeddings[j]);
      avgDist /= otherPoints.length;
      b_i = Math.min(b_i, avgDist);
    }

    if (b_i === Infinity) {
      silhouettes.push(0);
    } else {
      const maxAB = Math.max(a_i, b_i);
      silhouettes.push(maxAB === 0 ? 0 : (b_i - a_i) / maxAB);
    }
  }

  return silhouettes.length > 0 ? silhouettes.reduce((s, v) => s + v, 0) / silhouettes.length : 0;
}

/**
 * Adaptive threshold selection using silhouette score optimization.
 * Tests multiple thresholds and picks the one that produces the best clustering quality,
 * penalizing extreme cluster counts (too many = over-split, too few = under-merged).
 * 
 * @param {number[][]} embeddings - Embedding vectors
 * @param {object} options - Configuration
 * @param {number[]} options.thresholds - Thresholds to test (default: 0.55 to 0.85)
 * @param {number} options.minClusters - Minimum acceptable clusters (default: 3)
 * @param {number} options.maxClusters - Maximum acceptable clusters (default: ratio of submissions)
 * @param {string} options.linkage - "average" or "ward"
 * @returns {{ threshold: number, clusterCount: number, silhouette: number, analysis: object[] }}
 */
export function findOptimalThreshold(embeddings, options = {}) {
  const n = embeddings.length;
  const {
    thresholds = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85],
    minClusters = 3,
    maxClusters = Math.max(Math.floor(n / 3), 5),
    linkage = "average"
  } = options;

  const analysis = [];
  let bestScore = -Infinity;
  let bestThreshold = 0.70; // fallback

  for (const t of thresholds) {
    try {
      const clusters = agglomerativeCluster(embeddings, t, linkage);
      const clusterCount = clusters.length;

      // Build assignments array
      const assignments = new Array(n);
      clusters.forEach((group, idx) => {
        group.forEach(i => { assignments[i] = idx; });
      });

      const silhouette = calculateSilhouetteScore(embeddings, assignments);

      // Hard penalty for too few clusters
      let penalty = 0;
      if (clusterCount < minClusters) penalty += 0.5 * (minClusters - clusterCount);

      // Soft penalty for small clusters
      const smallClusters = clusters.filter(c => c.length < 3).length;
      const smallRatio = smallClusters / Math.max(clusterCount, 1);
      penalty += 0.1 * smallRatio;

      // Bonus for more clusters (merge step handles cleanup)
      const clusterBonus = 0.01 * Math.min(clusterCount, maxClusters);

      const adjustedScore = silhouette - penalty + clusterBonus;

      analysis.push({
        threshold: t,
        clusterCount,
        silhouette: Math.round(silhouette * 1000) / 1000,
        smallClusters,
        penalty: Math.round((penalty + smallPenalty) * 1000) / 1000,
        adjustedScore: Math.round(adjustedScore * 1000) / 1000
      });

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestThreshold = t;
      }
    } catch (e) {
      // Skip thresholds that cause errors
      analysis.push({ threshold: t, error: e.message });
    }
  }

  const bestResult = analysis.find(a => a.threshold === bestThreshold);

  return {
    threshold: bestThreshold,
    clusterCount: bestResult?.clusterCount || 0,
    silhouette: bestResult?.silhouette || 0,
    analysis
  };
}
