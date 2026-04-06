import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Prioritization.css";

const STRATEGIES = [
  {
    id: "balanced",
    name: "Balanced",
    icon: "⚖️",
    description: "Equal consideration of stakeholder demand, consensus, feasibility, and business value",
    weights: { demand: 0.20, consensus: 0.15, conflict: 0.10, value: 0.25, feasibility: 0.15, urgency: 0.15 }
  },
  {
    id: "stakeholder_driven",
    name: "Stakeholder-Driven",
    icon: "👥",
    description: "Prioritize what stakeholders want most — submission volume and consensus are king",
    weights: { demand: 0.35, consensus: 0.25, conflict: 0.10, value: 0.15, feasibility: 0.05, urgency: 0.10 }
  },
  {
    id: "feasibility_first",
    name: "Feasibility First",
    icon: "🔧",
    description: "Focus on what's buildable — technically feasible items rank higher",
    weights: { demand: 0.10, consensus: 0.10, conflict: 0.05, value: 0.20, feasibility: 0.40, urgency: 0.15 }
  },
  {
    id: "risk_aware",
    name: "Risk-Aware",
    icon: "🛡️",
    description: "Surface controversial and conflicting requirements that need resolution first",
    weights: { demand: 0.10, consensus: 0.25, conflict: 0.25, value: 0.15, feasibility: 0.10, urgency: 0.15 }
  }
];

const SCORE_LABELS = {
  demand: { name: "Stakeholder Demand", icon: "📊", desc: "How many stakeholders submitted requirements for this" },
  consensus: { name: "Consensus", icon: "🤝", desc: "How much stakeholders agree (from opinion mining)" },
  conflict: { name: "Conflict Impact", icon: "⚡", desc: "Severity of conflicts involving this cluster" },
  value: { name: "Business Value", icon: "💎", desc: "AI-assessed importance to project success" },
  feasibility: { name: "Feasibility", icon: "🔧", desc: "AI-assessed technical feasibility for MVP" },
  urgency: { name: "Urgency", icon: "⏰", desc: "AI-assessed time-criticality" }
};

function ScoreBar({ score, color, label }) {
  const pct = Math.round(score * 100);
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="score-bar-value">{pct}%</span>
    </div>
  );
}

function WeightSlider({ label, icon, value, onChange }) {
  return (
    <div className="weight-slider-row">
      <span className="weight-slider-label">{icon} {label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        className="weight-slider"
      />
      <span className="weight-slider-value">{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function Prioritization() {
  const { id: projectId } = useParams();

  const [strategy, setStrategy] = useState("balanced");
  const [customWeights, setCustomWeights] = useState(STRATEGIES[0].weights);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCluster, setExpandedCluster] = useState(null);
  const [clusterCount, setClusterCount] = useState(0);
  const [hasOpinions, setHasOpinions] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);

  // Check data availability on mount
  async function checkData() {
    setLoading(true);
    try {
      const [
        { count: clusters },
        { count: opinions },
        { count: conflicts },
        { data: existingResults }
      ] = await Promise.all([
        supabase.from("requirement_clusters").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("cluster_opinions").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        supabase.from("cluster_conflicts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        // NOTE: prioritization_results table (renamed from ahp_results via migration 005)
        supabase.from("prioritization_results").select("*, requirement_clusters(label, summary)").eq("project_id", projectId).order("rank")
      ]);

      setClusterCount(clusters || 0);
      setHasOpinions((opinions || 0) > 0);
      setHasConflicts((conflicts || 0) > 0);

      if (existingResults && existingResults.length > 0) {
        // Load previous results
        setResults({
          results: existingResults.map(r => ({
            cluster_id: r.cluster_id,
            cluster_label: r.requirement_clusters?.label || "Unknown",
            cluster_summary: r.requirement_clusters?.summary || "",
            composite_score: r.priority_score,
            rank: r.rank,
            scores: {},
            ai_reasoning: ""
          }))
        });
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { checkData(); }, [projectId]);

  // Update custom weights when strategy changes
  useEffect(() => {
    const s = STRATEGIES.find(s => s.id === strategy);
    if (s) setCustomWeights({ ...s.weights });
  }, [strategy]);

  async function runPrioritization() {
    setComputing(true);
    setError(null);

    try {
      const res = await fetch("/api/smartPrioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          strategy,
          custom_weights: strategy === "custom" ? customWeights : undefined
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Prioritization failed");
      } else {
        setResults(data);
      }
    } catch {
      setError("Network error. Make sure the server is running.");
    }

    setComputing(false);
  }

  function getRankBadge(rank) {
    if (rank === 1) return { class: "rank-gold", label: "🥇" };
    if (rank === 2) return { class: "rank-silver", label: "🥈" };
    if (rank === 3) return { class: "rank-bronze", label: "🥉" };
    return { class: "rank-default", label: `#${rank}` };
  }

  function getScoreColor(score) {
    if (score >= 0.8) return "#10b981";
    if (score >= 0.6) return "#3b82f6";
    if (score >= 0.4) return "#f59e0b";
    if (score >= 0.2) return "#ef4444";
    return "#6b7280";
  }

  if (loading) return <p className="prioritize-loading">Loading prioritization data...</p>;

  return (
    <div className="prioritize-page">
      {/* Header */}
      <div className="prioritize-header">
        <div>
          <h1 className="prioritize-title">Smart Prioritization</h1>
          <p className="prioritize-subtitle">
            AI-assisted priority ranking using data from your pipeline — stakeholder submissions, opinion mining, conflict detection, and feasibility analysis
          </p>
        </div>
      </div>

      {/* Data readiness indicators */}
      <div className="data-readiness">
        <div className={`readiness-badge ${clusterCount > 0 ? "ready" : "not-ready"}`}>
          {clusterCount > 0 ? "✓" : "○"} {clusterCount} Clusters
        </div>
        <div className={`readiness-badge ${hasOpinions ? "ready" : "not-ready"}`}>
          {hasOpinions ? "✓" : "○"} Opinion Mining
        </div>
        <div className={`readiness-badge ${hasConflicts ? "ready" : "not-ready"}`}>
          {hasConflicts ? "✓" : "○"} Conflict Detection
        </div>
        <div className="readiness-badge ready">✓ AI Assessment</div>
      </div>

      {clusterCount === 0 ? (
        <div className="prioritize-empty">
          <p>No clusters found. Run clustering first to group stakeholder submissions, then come back to prioritize.</p>
        </div>
      ) : (
        <>
          {/* Strategy Selection */}
          <div className="strategy-section">
            <h2 className="section-title">Choose Your Strategy</h2>
            <p className="section-desc">Pick a prioritization lens. Each strategy weighs the 6 scoring dimensions differently.</p>
            
            <div className="strategy-grid">
              {STRATEGIES.map(s => (
                <div
                  key={s.id}
                  className={`strategy-card ${strategy === s.id ? "selected" : ""}`}
                  onClick={() => setStrategy(s.id)}
                >
                  <div className="strategy-icon">{s.icon}</div>
                  <div className="strategy-name">{s.name}</div>
                  <div className="strategy-desc">{s.description}</div>
                </div>
              ))}
              <div
                className={`strategy-card ${strategy === "custom" ? "selected" : ""}`}
                onClick={() => setStrategy("custom")}
              >
                <div className="strategy-icon">🎛️</div>
                <div className="strategy-name">Custom</div>
                <div className="strategy-desc">Fine-tune the weight of each dimension yourself</div>
              </div>
            </div>

            {/* Custom weight sliders */}
            {strategy === "custom" && (
              <div className="custom-weights">
                {Object.entries(SCORE_LABELS).map(([key, meta]) => (
                  <WeightSlider
                    key={key}
                    label={meta.name}
                    icon={meta.icon}
                    value={customWeights[key] || 0}
                    onChange={(val) => setCustomWeights(prev => ({ ...prev, [key]: val }))}
                  />
                ))}
              </div>
            )}

            {/* Weight visualization for selected strategy */}
            {strategy !== "custom" && (
              <div className="weight-preview">
                <h3 className="weight-preview-title">Weight Distribution</h3>
                <div className="weight-bars">
                  {Object.entries(STRATEGIES.find(s => s.id === strategy)?.weights || {}).map(([key, w]) => (
                    <div key={key} className="weight-bar-item">
                      <span className="weight-bar-label">{SCORE_LABELS[key]?.icon} {SCORE_LABELS[key]?.name}</span>
                      <div className="weight-bar-track">
                        <div className="weight-bar-fill" style={{ width: `${w * 100}%` }} />
                      </div>
                      <span className="weight-bar-pct">{Math.round(w * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              className="btn-prioritize"
              onClick={runPrioritization}
              disabled={computing || clusterCount === 0}
            >
              {computing ? "Computing..." : results ? "Re-prioritize" : "Run Smart Prioritization"}
            </button>
          </div>

          {error && <div className="prioritize-error">{error}</div>}

          {/* Results */}
          {results && results.results && (
            <div className="results-section">
              <h2 className="section-title">Priority Rankings</h2>
              <p className="section-desc">
                {results.total_clusters || results.results.length} clusters ranked by composite score.
                {results.strategy && ` Strategy: ${STRATEGIES.find(s => s.id === results.strategy)?.name || results.strategy}.`}
              </p>

              <div className="results-list">
                {results.results.map((r) => {
                  const rankInfo = getRankBadge(r.rank);
                  const isExpanded = expandedCluster === r.cluster_id;

                  return (
                    <div
                      key={r.cluster_id}
                      className={`result-card ${rankInfo.class} ${isExpanded ? "expanded" : ""}`}
                      onClick={() => setExpandedCluster(isExpanded ? null : r.cluster_id)}
                    >
                      <div className="result-main">
                        <div className="result-rank">{rankInfo.label}</div>
                        <div className="result-info">
                          <div className="result-label">{r.cluster_label}</div>
                          {r.cluster_summary && (
                            <div className="result-summary">{r.cluster_summary}</div>
                          )}
                        </div>
                        <div className="result-score">
                          <div className="score-number">{r.composite_score.toFixed(1)}</div>
                          <div className="score-label">/ 10</div>
                        </div>
                        <div className="result-bar-container">
                          <div
                            className="result-bar"
                            style={{
                              width: `${(r.composite_score / 10) * 100}%`,
                              background: r.rank <= 3
                                ? `linear-gradient(90deg, ${getScoreColor(r.composite_score / 10)}, ${getScoreColor(r.composite_score / 10)}cc)`
                                : getScoreColor(r.composite_score / 10)
                            }}
                          />
                        </div>
                      </div>

                      {/* Expanded breakdown */}
                      {isExpanded && r.scores && Object.keys(r.scores).length > 0 && (
                        <div className="result-breakdown">
                          <div className="breakdown-title">Score Breakdown</div>
                          <div className="breakdown-grid">
                            {Object.entries(r.scores).map(([key, score]) => (
                              <ScoreBar
                                key={key}
                                score={score}
                                color={getScoreColor(score)}
                                label={`${SCORE_LABELS[key]?.icon || ""} ${SCORE_LABELS[key]?.name || key}`}
                              />
                            ))}
                          </div>
                          {r.ai_reasoning && (
                            <div className="ai-reasoning">
                              <span className="reasoning-label">🤖 AI Assessment:</span> {r.ai_reasoning}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
