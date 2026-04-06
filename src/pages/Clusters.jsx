import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Clusters.css";

export default function Clusters() {
  const { id: projectId } = useParams();

  const [clusters, setClusters] = useState([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  /** Submissions that have an embedding (required for Run Clustering) */
  const [readyCount, setReadyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);
  const [relabeling, setRelabeling] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState(null);

  async function fetchClusters() {
    setLoading(true);
    setError(null);

    // Get clusters
    const { data: clusterData, error: clusterError } = await supabase
      .from("requirement_clusters")
      .select("*")
      .eq("project_id", projectId)
      .order("submission_count", { ascending: false });

    if (clusterError) {
      setError("Failed to load clusters.");
      setLoading(false);
      return;
    }

    // For each cluster, fetch linked processed requirements
    const enriched = await Promise.all(
      (clusterData || []).map(async (cluster) => {
        const { data: processedReqs } = await supabase
          .from("processed_requirements")
          .select("text, submission_id")
          .eq("cluster_id", cluster.id)
          .order("created_at", { ascending: true });

        // Also fetch raw submissions for fallback (old clusters from manual clustering)
        const { data: submissions } = await supabase
          .from("stakeholder_submissions")
          .select("raw_text, stakeholder_role")
          .eq("cluster_id", cluster.id);

        return {
          ...cluster,
          processedReqs: processedReqs || [],
          submissions: submissions || [],
        };
      })
    );

    setClusters(enriched);

    // Get total submission count
    const { count } = await supabase
      .from("stakeholder_submissions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    setSubmissionCount(count || 0);

    const { count: ready } = await supabase
      .from("stakeholder_submissions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .not("embedding", "is", null);

    setReadyCount(ready || 0);
    setLoading(false);
  }

  async function runClustering() {
    setClustering(true);
    setError(null);

    try {
      const res = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Clustering failed.");
      } else {
        // Store quality metrics from clustering result
        if (result.quality_metrics) {
          setQualityMetrics(result.quality_metrics);
        }
        await fetchClusters();
      }
    } catch {
      setError("Network error. Make sure the server is running.");
    }

    setClustering(false);
  }

  async function relabelClusters() {
    setRelabeling(true);
    setError(null);

    try {
      const res = await fetch("/api/relabelClusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Relabeling failed.");
      } else {
        await fetchClusters();
      }
    } catch {
      setError("Network error. Make sure the server is running.");
    }

    setRelabeling(false);
  }

  useEffect(() => {
    fetchClusters();
  }, [projectId]);

  function toggleExpand(id) {
    setExpandedId(expandedId === id ? null : id);
  }

  if (loading) return <p className="clusters-loading">Loading clusters...</p>;

  return (
    <div className="clusters-page">
      <div className="clusters-header">
        <div>
          <h1 className="clusters-title">Requirement Clusters</h1>
          <p className="clusters-subtitle">
            {submissionCount} submission{submissionCount !== 1 ? "s" : ""} collected
            {readyCount < submissionCount &&
              ` (${readyCount} ready to cluster — embeddings still processing for others)`}
            {clusters.length > 0 && ` — grouped into ${clusters.length} cluster${clusters.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {clusters.some(c => !c.label) && (
            <button
              className="btn-cluster"
              onClick={relabelClusters}
              disabled={relabeling}
              style={{ background: "#d97706" }}
            >
              {relabeling ? "Labeling..." : "Fix Missing Labels"}
            </button>
          )}
          <button
            className="btn-cluster"
            onClick={runClustering}
            disabled={clustering || readyCount < 1}
            title={
              readyCount < 1
                ? "Wait until at least one submission has an embedding (usually a few seconds)"
                : undefined
            }
          >
            {clustering ? "Clustering..." : clusters.length > 0 ? "Re-cluster" : "Run Clustering"}
          </button>
        </div>
      </div>

      {error && <div className="clusters-error">{error}</div>}

      {qualityMetrics && clusters.length > 0 && qualityMetrics.interpretation === "single_group" && (
        <div
          className="clusters-empty"
          style={{ marginBottom: "1.5rem", textAlign: "left" }}
        >
          <p style={{ margin: 0 }}>
            <strong>Single submission clustered.</strong> Silhouette and threshold tuning apply when
            you have two or more submissions with embeddings.
          </p>
        </div>
      )}

      {qualityMetrics && clusters.length > 0 && qualityMetrics.interpretation !== "single_group" && (
        <div style={{
          background: '#12121a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ 
            color: '#e0e0e8', 
            margin: '0 0 0.75rem 0', 
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            Cluster Quality
          </h3>
          {qualityMetrics.similarity_fusion && (
            <p style={{ fontSize: "0.8rem", color: "rgba(224,224,232,0.75)", margin: "0 0 0.75rem 0", lineHeight: 1.45 }}>
              Pairwise links blend <strong>semantic</strong> (embedding cosine) and{" "}
              <strong>syntactic</strong> (word + character overlap):{" "}
              {Math.round(qualityMetrics.similarity_fusion.semantic_weight * 100)}% /{" "}
              {Math.round(qualityMetrics.similarity_fusion.syntactic_weight * 100)}%. Override with{" "}
              <code>CLUSTER_SEM_WEIGHT</code> / <code>CLUSTER_SYN_WEIGHT</code>.
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <span style={{ color: '#e0e0e8' }}>Silhouette Score:</span>
            <span style={{
              background: qualityMetrics.silhouette_score < 0.25 ? '#dc2626' : 
                         qualityMetrics.silhouette_score < 0.50 ? '#d97706' :
                         qualityMetrics.silhouette_score < 0.75 ? '#16a34a' : '#2563eb',
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              {qualityMetrics.silhouette_score}
            </span>
            <span style={{
              color: qualityMetrics.silhouette_score < 0.25 ? '#dc2626' : 
                     qualityMetrics.silhouette_score < 0.50 ? '#d97706' :
                     qualityMetrics.silhouette_score < 0.75 ? '#16a34a' : '#2563eb',
              fontWeight: '600',
              textTransform: 'capitalize'
            }}>
              {qualityMetrics.interpretation}
            </span>
          </div>
          <p style={{ 
            color: 'rgba(224,224,232,0.7)', 
            margin: '0',
            fontSize: '0.875rem',
            lineHeight: '1.4'
          }}>
            Silhouette score measures how well submissions fit their assigned clusters. 
            Higher scores indicate better separation between clusters.
          </p>
          
          {qualityMetrics.threshold_analysis && qualityMetrics.threshold_analysis.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 style={{ color: '#e0e0e8', margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
                Threshold Analysis
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div style={{ color: '#a1a1aa', fontWeight: '600' }}>Threshold</div>
                <div style={{ color: '#a1a1aa', fontWeight: '600' }}>Clusters</div>
                <div style={{ color: '#a1a1aa', fontWeight: '600' }}>Silhouette Score</div>
                
                {qualityMetrics.threshold_analysis.map((analysis, idx) => (
                  <React.Fragment key={idx}>
                    <div style={{ 
                      color: analysis.threshold === 0.70 ? '#22c55e' : '#e0e0e8',
                      fontWeight: analysis.threshold === 0.70 ? '600' : '400'
                    }}>
                      {analysis.threshold.toFixed(2)} {analysis.threshold === 0.70 && '✓'}
                    </div>
                    <div style={{ 
                      color: analysis.threshold === 0.70 ? '#22c55e' : '#e0e0e8',
                      fontWeight: analysis.threshold === 0.70 ? '600' : '400'
                    }}>
                      {analysis.cluster_count}
                    </div>
                    <div style={{ 
                      color: analysis.threshold === 0.70 ? '#22c55e' : '#e0e0e8',
                      fontWeight: analysis.threshold === 0.70 ? '600' : '400'
                    }}>
                      {analysis.silhouette_score.toFixed(2)}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p style={{ 
                color: 'rgba(224,224,232,0.7)', 
                margin: '0.75rem 0 0 0',
                fontSize: '0.8rem',
                lineHeight: '1.4'
              }}>
                Threshold analysis shows why 0.70 was chosen. ✓ indicates the selected threshold.
              </p>
            </div>
          )}
        </div>
      )}

      {submissionCount === 0 && (
        <div className="clusters-empty">
          <p>No submissions yet. Share the stakeholder link to start collecting input.</p>
        </div>
      )}

      {submissionCount > 0 && readyCount === 0 && !clustering && (
        <div className="clusters-empty">
          <p>
            <strong>Waiting for embeddings.</strong> Submissions are saved; vector embeddings are
            generated in the background. Refresh in a few seconds, or check that{" "}
            <code>OPENAI_API_KEY</code> is set on the server.
          </p>
        </div>
      )}

      {submissionCount > 0 && readyCount > 0 && clusters.length === 0 && !clustering && (
        <div className="clusters-empty">
          <p>
            No clusters yet. Click <strong>Run Clustering</strong> above to group submissions
            {readyCount === 1
              ? " into a single cluster (you can add more submissions later for multi-cluster analysis)."
              : " by similarity."}
          </p>
        </div>
      )}

      <div className="clusters-list">
        {clusters.map((cluster) => (
          <div key={cluster.id} className="cluster-card">
            <div
              className="cluster-card-header"
              onClick={() => toggleExpand(cluster.id)}
            >
              <div className="cluster-card-meta">
                <span className="cluster-label">{cluster.label}</span>
                <span className="cluster-count">
                  {cluster.submission_count} submission{cluster.submission_count !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="cluster-summary">{cluster.summary}</p>
              <span className="cluster-toggle">
                {expandedId === cluster.id ? "Hide submissions" : "Show submissions"}
              </span>
            </div>

            {expandedId === cluster.id && (
              <div className="cluster-submissions">
                {cluster.processedReqs.length > 0 ? (
                  <>
                    <p className="cluster-section-label">AI-extracted requirements ({cluster.processedReqs.length})</p>
                    {cluster.processedReqs.map((req, i) => (
                      <div key={i} className="cluster-submission-item processed-req">
                        <span className="req-bullet">✦</span>
                        <p className="sub-content">{req.text}</p>
                      </div>
                    ))}
                  </>
                ) : cluster.submissions.length > 0 ? (
                  <>
                    <p className="cluster-section-label">Raw submissions ({cluster.submissions.length})</p>
                    {cluster.submissions.map((sub, i) => (
                      <div key={i} className="cluster-submission-item">
                        <p className="sub-content">"{sub.raw_text}"</p>
                        {sub.stakeholder_role && (
                          <span className="sub-role">{sub.stakeholder_role}</span>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <p style={{ color: "#71717a", fontSize: "0.85rem", padding: "0.5rem" }}>No requirements yet.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
