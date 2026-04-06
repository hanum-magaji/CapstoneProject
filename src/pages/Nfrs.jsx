import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Nfrs.css";

const ISO_CATEGORY_COLORS = {
  "Performance": "#3b82f6", // blue
  "Reliability": "#10b981", // green  
  "Security": "#ef4444", // red
  "Usability": "#f59e0b", // amber
  "Compatibility": "#8b5cf6", // violet
  "Maintainability": "#06b6d4", // cyan
  "Portability": "#84cc16", // lime
  "Functional Suitability": "#f97316", // orange
};

export default function Nfrs() {
  const { id: projectId } = useParams();

  const [nfrs, setNfrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  });

  async function fetchNfrs() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("project_nfrs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("Failed to load NFRs.");
      setLoading(false);
      return;
    }

    setNfrs(data || []);

    // Calculate status counts
    const counts = { pending: 0, approved: 0, rejected: 0 };
    (data || []).forEach(nfr => {
      counts[nfr.status] = (counts[nfr.status] || 0) + 1;
    });
    setStatusCounts(counts);

    setLoading(false);
  }

  async function generateNfrs() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generateNfrs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Failed to generate NFRs.");
      } else {
        await fetchNfrs();
      }
    } catch {
      setError("Network error. Make sure the server is running.");
    }

    setGenerating(false);
  }

  async function updateNfrStatus(nfrId, newStatus) {
    const { error: updateError } = await supabase
      .from("project_nfrs")
      .update({ status: newStatus })
      .eq("id", nfrId);

    if (updateError) {
      setError("Failed to update NFR status.");
      return;
    }

    // Update local state
    setNfrs(prev => prev.map(nfr => 
      nfr.id === nfrId ? { ...nfr, status: newStatus } : nfr
    ));

    // Update status counts
    const updatedNfrs = nfrs.map(nfr => 
      nfr.id === nfrId ? { ...nfr, status: newStatus } : nfr
    );
    const counts = { pending: 0, approved: 0, rejected: 0 };
    updatedNfrs.forEach(nfr => {
      counts[nfr.status] = (counts[nfr.status] || 0) + 1;
    });
    setStatusCounts(counts);
  }

  function toggleExpanded(id) {
    setExpandedId(expandedId === id ? null : id);
  }

  function getCategoryColor(category) {
    return ISO_CATEGORY_COLORS[category] || "#6b7280";
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case "approved": return "status-badge status-approved";
      case "rejected": return "status-badge status-rejected";
      default: return "status-badge status-pending";
    }
  }

  useEffect(() => {
    fetchNfrs();
  }, [projectId]);

  if (loading) return <p className="nfrs-loading">Loading NFRs...</p>;

  return (
    <div className="nfrs-page">
      <div className="nfrs-header">
        <div>
          <h1 className="nfrs-title">Non-Functional Requirements</h1>
          <p className="nfrs-subtitle">
            Quality attributes and constraints based on ISO/IEC 25010 standards
          </p>
          <div className="nfrs-stats">
            <span className="stat-item approved">{statusCounts.approved} approved</span>
            <span className="stat-item pending">{statusCounts.pending} pending</span>
            <span className="stat-item rejected">{statusCounts.rejected} rejected</span>
          </div>
        </div>
        <button
          className="btn-generate"
          onClick={generateNfrs}
          disabled={generating}
        >
          {generating ? "Generating..." : nfrs.length > 0 ? "Regenerate NFRs" : "Generate NFRs"}
        </button>
      </div>

      {error && <div className="nfrs-error">{error}</div>}

      {nfrs.length === 0 && !generating && (
        <div className="nfrs-empty">
          <p>No NFRs generated yet. Click "Generate NFRs" to analyze your project and create quality requirements.</p>
          <p>NFRs will be generated based on your project description and existing requirement clusters.</p>
        </div>
      )}

      <div className="nfrs-list">
        {nfrs.map((nfr) => (
          <div key={nfr.id} className="nfr-card">
            <div className="nfr-header">
              <div className="nfr-meta">
                <span 
                  className="category-badge"
                  style={{ backgroundColor: getCategoryColor(nfr.category) }}
                >
                  {nfr.category}
                </span>
                <span className={getStatusBadgeClass(nfr.status)}>
                  {nfr.status}
                </span>
              </div>
              
              {nfr.status === "pending" && (
                <div className="nfr-actions">
                  <button
                    className="btn-action btn-approve"
                    onClick={() => updateNfrStatus(nfr.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-action btn-reject"
                    onClick={() => updateNfrStatus(nfr.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>

            <p className="nfr-description">{nfr.description}</p>
            
            <div
              className="nfr-rationale-toggle"
              onClick={() => toggleExpanded(nfr.id)}
            >
              {expandedId === nfr.id ? "Hide rationale" : "Show rationale"}
            </div>

            {expandedId === nfr.id && (
              <div className="nfr-rationale">
                <strong>Rationale:</strong> {nfr.rationale}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}