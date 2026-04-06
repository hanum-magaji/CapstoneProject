import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Conflicts.css";

export default function Conflicts() {
  const { id: projectId } = useParams();

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  async function fetchConflicts() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("cluster_conflicts")
      .select("*, cluster_a:cluster_a_id(label, summary), cluster_b:cluster_b_id(label, summary)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      setError("Failed to load conflicts.");
      setLoading(false);
      return;
    }

    setConflicts(data || []);
    setLoading(false);
  }

  async function runConflictAnalysis() {
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Conflict analysis failed.");
      } else {
        await fetchConflicts();
      }
    } catch {
      setError("Network error or server not responding.");
    }

    setAnalyzing(false);
  }

  useEffect(() => {
    fetchConflicts();
  }, [projectId]);

  const severityColors = {
    high: "var(--red)",
    medium: "var(--orange)",
    low: "var(--yellow)",
  };

  const severityIcons = {
    high: "⚠️",
    medium: "⚙️",
    low: "🔍",
  };

  const typeLabels = {
    contradiction: "Contradiction",
    similar_requirement: "Similar requirement",
    competing_priority: "Competing priority",
    redundant_wording: "Redundant wording",
    none: "Other",
  };

  if (loading) return <p className="conflicts-loading">Loading conflicts...</p>;

  return (
    <div className="conflicts-page">
      <div className="conflicts-header">
        <div>
          <h1 className="conflicts-title">Stakeholder Conflicts</h1>
          <p className="conflicts-subtitle">
            Contradictions, near-duplicates, and competing priorities — with suggested resolutions
          </p>
        </div>
        
        <button 
          className="btn-conflict"
          onClick={runConflictAnalysis}
          disabled={analyzing}
        >
          {analyzing ? "Analyzing..." : "Run Conflict Analysis"}
        </button>
      </div>

      {error && <div className="conflicts-error">{error}</div>}

      {conflicts.length === 0 && !error && (
        <div className="conflicts-empty">
          <p>No issues recorded yet.</p>
          <p>
            Run <strong>Conflict Analysis</strong> after clustering. We scan cluster pairs for
            contradictions and similar wording, and flag overlapping lines within the same cluster.
          </p>
        </div>
      )}

      <div className="conflicts-list">
        {conflicts.map((conflict) => {
          const sev = conflict.severity || "medium";
          return (
          <div 
            key={conflict.id} 
            className={`conflict-card severity-${sev}`}
            style={{ borderLeftColor: severityColors[sev], backgroundColor: "var(--bg)" }}
          >
            <div className="conflict-header">
              <div className="conflict-meta">
                <span
                  className="conflict-type-pill"
                  data-type={conflict.conflict_type || "contradiction"}
                >
                  {typeLabels[conflict.conflict_type] || typeLabels.contradiction}
                </span>
                <span 
                  className="conflict-severity-badge"
                  style={{ color: severityColors[sev] }}
                >
                  {severityIcons[sev]} {sev.toUpperCase()}
                </span>
                <span className="conflict-label">
                  {conflict.cluster_a?.label} ↔ {conflict.cluster_b?.label}
                </span>
              </div>
            </div>

            <div className="conflict-description">
              {conflict.description}
            </div>

            {conflict.resolution_suggestion && (
              <div className="conflict-resolution">
                <strong>Suggested resolution</strong>
                <p>{conflict.resolution_suggestion}</p>
              </div>
            )}

            <div className="conflict-details">
              <div className="cluster-preview">
                <div className="cluster-a">
                  <strong>{conflict.cluster_a?.label}</strong>
                  <p>{conflict.cluster_a?.summary}</p>
                </div>
                <div className="conflict-arrow">❗</div>
                <div className="cluster-b">
                  <strong>{conflict.cluster_b?.label}</strong>
                  <p>{conflict.cluster_b?.summary}</p>
                </div>
              </div>

              {conflict.specific_points && conflict.specific_points.length > 0 && (
                <div className="conflict-points">
                  <strong>Key points:</strong>
                  <ul>
                    {conflict.specific_points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}