import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Opinions.css";

const STANCE_COLORS = {
  "supportive": "#10b981", // green
  "opposed": "#ef4444", // red
  "neutral": "#6b7280", // gray
  "alternative": "#8b5cf6" // violet
};

export default function Opinions() {
  const { id: projectId } = useParams();

  const [clusterAnalysis, setClusterAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCluster, setExpandedCluster] = useState(null);
  const [expandedViewpoints, setExpandedViewpoints] = useState(new Set());

  async function fetchOpinionAnalysis() {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel instead of per-cluster sequential calls
      const [
        { data: clusters, error: clustersError },
        { data: allDivergence },
        { data: allOpinions },
        { data: allSubmissions }
      ] = await Promise.all([
        supabase
          .from("requirement_clusters")
          .select("*")
          .eq("project_id", projectId)
          .order("submission_count", { ascending: false }),
        supabase
          .from("cluster_divergence_scores")
          .select("*")
          .eq("project_id", projectId),
        supabase
          .from("cluster_opinions")
          .select("*")
          .eq("project_id", projectId)
          .order("stakeholder_count", { ascending: false }),
        supabase
          .from("stakeholder_submissions")
          .select("id, raw_text, stakeholder_role, cluster_id")
          .eq("project_id", projectId)
      ]);

      if (clustersError) throw clustersError;

      // Index by cluster_id for fast lookup
      const divergenceMap = {};
      (allDivergence || []).forEach(d => { divergenceMap[d.cluster_id] = d; });

      const opinionsMap = {};
      (allOpinions || []).forEach(o => {
        if (!opinionsMap[o.cluster_id]) opinionsMap[o.cluster_id] = [];
        opinionsMap[o.cluster_id].push(o);
      });

      const submissionsMap = {};
      const submissionsByCluster = {};
      (allSubmissions || []).forEach(s => {
        submissionsMap[s.id] = s;
        if (!submissionsByCluster[s.cluster_id]) submissionsByCluster[s.cluster_id] = [];
        submissionsByCluster[s.cluster_id].push(s);
      });

      const analysisData = (clusters || []).map(cluster => {
        const opinions = opinionsMap[cluster.id] || [];
        const clusterSubmissions = submissionsByCluster[cluster.id] || [];

        const enrichedOpinions = opinions.map(opinion => ({
          ...opinion,
          submissions: JSON.parse(opinion.submission_ids || "[]")
            .map(id => submissionsMap[id])
            .filter(Boolean)
        }));

        return {
          cluster,
          divergence: divergenceMap[cluster.id] || null,
          opinions: enrichedOpinions,
          totalSubmissions: clusterSubmissions.length
        };
      });

      setClusterAnalysis(analysisData);
    } catch (err) {
      setError("Failed to load opinion analysis.");
      console.error(err);
    }

    setLoading(false);
  }

  async function runOpinionAnalysis() {
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/opinions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Opinion analysis failed.");
      } else {
        await fetchOpinionAnalysis();
      }
    } catch {
      setError("Network error. Make sure the server is running.");
    }

    setAnalyzing(false);
  }

  function getDivergenceLevel(score) {
    if (score >= 0.8) return { level: "extreme", color: "#dc2626" };
    if (score >= 0.5) return { level: "high", color: "#ea580c" };
    if (score >= 0.2) return { level: "moderate", color: "#d97706" };
    return { level: "low", color: "#16a34a" };
  }

  function getStanceColor(stance) {
    return STANCE_COLORS[stance] || "#6b7280";
  }

  function toggleClusterExpansion(clusterId) {
    setExpandedCluster(expandedCluster === clusterId ? null : clusterId);
  }

  function toggleViewpointExpansion(viewpointId) {
    const newSet = new Set(expandedViewpoints);
    if (newSet.has(viewpointId)) {
      newSet.delete(viewpointId);
    } else {
      newSet.add(viewpointId);
    }
    setExpandedViewpoints(newSet);
  }

  useEffect(() => {
    fetchOpinionAnalysis();
  }, [projectId]);

  if (loading) return <p className="opinions-loading">Loading opinion analysis...</p>;

  const analyzedClusters = clusterAnalysis.filter(c => c.divergence || c.opinions.length > 0);
  const eligibleClusters = clusterAnalysis.filter(c => c.totalSubmissions >= 3).length;

  return (
    <div className="opinions-page">
      <div className="opinions-header">
        <div>
          <h1 className="opinions-title">Viewpoint Analysis</h1>
          <p className="opinions-subtitle">
            Intra-cluster opinion mining to identify divergent viewpoints and stakeholder consensus
          </p>
          <div className="opinions-stats">
            <span className="stat-item">{analyzedClusters.length} clusters analyzed</span>
            <span className="stat-item">{eligibleClusters} clusters eligible (3+ submissions)</span>
          </div>
        </div>
        <button
          className="btn-analyze"
          onClick={runOpinionAnalysis}
          disabled={analyzing || eligibleClusters === 0}
        >
          {analyzing ? "Analyzing..." : analyzedClusters.length > 0 ? "Re-run Analysis" : "Run Opinion Analysis"}
        </button>
      </div>

      {error && <div className="opinions-error">{error}</div>}

      {eligibleClusters === 0 && (
        <div className="opinions-empty">
          <p>No clusters with sufficient submissions for opinion analysis.</p>
          <p>You need clusters with at least 3 stakeholder submissions to identify different viewpoints.</p>
        </div>
      )}

      {analyzedClusters.length === 0 && eligibleClusters > 0 && !analyzing && (
        <div className="opinions-empty">
          <p>No opinion analysis performed yet.</p>
          <p>Click "Run Opinion Analysis" to identify divergent viewpoints within your requirement clusters.</p>
        </div>
      )}

      <div className="clusters-analysis-list">
        {analyzedClusters.map((item) => {
          const { cluster, divergence, opinions } = item;
          const divergenceInfo = divergence ? getDivergenceLevel(divergence.divergence_score) : null;

          return (
            <div key={cluster.id} className="cluster-analysis-card">
              <div
                className="cluster-analysis-header"
                onClick={() => toggleClusterExpansion(cluster.id)}
              >
                <div className="cluster-info">
                  <div className="cluster-title-row">
                    <h3 className="cluster-label">{cluster.label}</h3>
                    <span className="submission-count">{cluster.submission_count} submissions</span>
                  </div>
                  <p className="cluster-summary">{cluster.summary}</p>
                  
                  {divergence && (
                    <div className="divergence-section">
                      <div className="divergence-bar-container">
                        <div className="divergence-label">
                          <span>Divergence Level: </span>
                          <span className="divergence-value" style={{ color: divergenceInfo.color }}>
                            {(divergence.divergence_score * 100).toFixed(0)}% ({divergenceInfo.level})
                          </span>
                        </div>
                        <div className="divergence-bar">
                          <div 
                            className="divergence-fill"
                            style={{ 
                              width: `${divergence.divergence_score * 100}%`,
                              backgroundColor: divergenceInfo.color
                            }}
                          />
                        </div>
                      </div>
                      <div className="viewpoints-count">
                        {opinions.length} distinct viewpoints identified
                      </div>
                    </div>
                  )}
                </div>
                
                <span className="expand-toggle">
                  {expandedCluster === cluster.id ? "Hide viewpoints" : "Show viewpoints"}
                </span>
              </div>

              {expandedCluster === cluster.id && opinions.length > 0 && (
                <div className="viewpoints-section">
                  {opinions.map((viewpoint) => (
                    <div key={viewpoint.id} className="viewpoint-card">
                      <div className="viewpoint-header">
                        <div className="viewpoint-meta">
                          <h4 className="viewpoint-label">{viewpoint.viewpoint_label}</h4>
                          <span 
                            className="stance-badge"
                            style={{ backgroundColor: getStanceColor(viewpoint.stance) }}
                          >
                            {viewpoint.stance}
                          </span>
                          <span className="stakeholder-count">
                            {viewpoint.stakeholder_count} stakeholders
                          </span>
                        </div>
                      </div>
                      
                      <p className="viewpoint-summary">{viewpoint.viewpoint_summary}</p>
                      
                      <div
                        className="submissions-toggle"
                        onClick={() => toggleViewpointExpansion(viewpoint.id)}
                      >
                        {expandedViewpoints.has(viewpoint.id) 
                          ? "Hide submissions" 
                          : `Show ${viewpoint.submissions.length} submissions`
                        }
                      </div>

                      {expandedViewpoints.has(viewpoint.id) && (
                        <div className="viewpoint-submissions">
                          {viewpoint.submissions.map((submission, index) => (
                            <div key={index} className="viewpoint-submission-item">
                              <p className="submission-text">"{submission.raw_text}"</p>
                              {submission.stakeholder_role && (
                                <span className="submission-role">{submission.stakeholder_role}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}