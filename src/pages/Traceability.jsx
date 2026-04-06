import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Traceability.css";

export default function Traceability() {
  const { id: projectId } = useParams();

  // State
  const [activeView, setActiveView] = useState("trace"); // "trace" | "overview"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Data
  const [submissions, setSubmissions] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [opinions, setOpinions] = useState([]);
  const [divergence, setDivergence] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [nfrs, setNfrs] = useState([]);
  const [results, setResults] = useState([]);

  // Lookup maps
  const [clusterLookup, setClusterLookup] = useState({});
  const [divergenceLookup, setDivergenceLookup] = useState({});
  const [resultsLookup, setResultsLookup] = useState({});

  // Load all data
  useEffect(() => {
    async function fetchAllData() {
      setLoading(true);
      setError(null);

      try {
        const [
          submissionsRes,
          clustersRes,
          opinionsRes,
          divergenceRes,
          conflictsRes,
          nfrsRes,
          resultsRes,
        ] = await Promise.all([
          supabase.from("stakeholder_submissions").select("*").eq("project_id", projectId).order("created_at"),
          supabase.from("requirement_clusters").select("*").eq("project_id", projectId).order("created_at"),
          supabase.from("cluster_opinions").select("*").eq("project_id", projectId),
          supabase.from("cluster_divergence_scores").select("*").eq("project_id", projectId),
          supabase.from("cluster_conflicts").select("*").eq("project_id", projectId),
          supabase.from("project_nfrs").select("*").eq("project_id", projectId),
          supabase.from("prioritization_results").select("*").eq("project_id", projectId).order("rank"),
        ]);

        if (submissionsRes.error) throw submissionsRes.error;
        if (clustersRes.error) throw clustersRes.error;
        if (opinionsRes.error) throw opinionsRes.error;
        if (divergenceRes.error) throw divergenceRes.error;
        if (conflictsRes.error) throw conflictsRes.error;
        if (nfrsRes.error) throw nfrsRes.error;
        if (resultsRes.error) throw resultsRes.error;

        setSubmissions(submissionsRes.data || []);
        setClusters(clustersRes.data || []);
        setOpinions(opinionsRes.data || []);
        setDivergence(divergenceRes.data || []);
        setConflicts(conflictsRes.data || []);
        setNfrs(nfrsRes.data || []);
        setResults(resultsRes.data || []);

        // Build lookup maps
        const clusterMap = {};
        (clustersRes.data || []).forEach(c => { clusterMap[c.id] = c; });
        setClusterLookup(clusterMap);

        const divergenceMap = {};
        (divergenceRes.data || []).forEach(d => { divergenceMap[d.cluster_id] = d; });
        setDivergenceLookup(divergenceMap);

        const resultsMap = {};
        (resultsRes.data || []).forEach(r => { resultsMap[r.cluster_id] = r; });
        setResultsLookup(resultsMap);

      } catch (err) {
        console.error("Error fetching traceability data:", err);
        setError("Failed to load traceability data");
      }

      setLoading(false);
    }

    fetchAllData();
  }, [projectId]);

  const truncateText = (text, length = 50) => {
    if (!text) return "";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const findSubmissionOpinion = (submissionId) => {
    return opinions.find(opinion => {
      if (!opinion.submission_ids) return false;
      
      let submissionIds = opinion.submission_ids;
      // Parse JSON string if needed
      if (typeof submissionIds === 'string') {
        try {
          submissionIds = JSON.parse(submissionIds);
        } catch (e) {
          console.warn('Failed to parse submission_ids JSON:', submissionIds);
          return false;
        }
      }
      
      return Array.isArray(submissionIds) && submissionIds.includes(submissionId);
    });
  };

  const getClusterConflicts = (clusterId) => {
    return conflicts.filter(conflict => 
      conflict.cluster_a_id === clusterId || conflict.cluster_b_id === clusterId
    );
  };

  const getStageData = (submission) => {
    if (!submission) return {};

    const cluster = clusterLookup[submission.cluster_id];
    const opinion = findSubmissionOpinion(submission.id);
    const clusterDivergence = divergenceLookup[submission.cluster_id];
    const clusterConflicts = getClusterConflicts(submission.cluster_id);
    const priorityResult = resultsLookup[submission.cluster_id];

    return {
      cluster,
      opinion,
      clusterDivergence,
      clusterConflicts,
      priorityResult,
      nfrs,
    };
  };

  if (loading) return <div className="traceability-loading">Loading traceability data...</div>;
  if (error) return <div className="traceability-error">{error}</div>;

  return (
    <div className="traceability-page">
      <div className="traceability-header">
        <h1 className="traceability-title">End-to-End Traceability</h1>
        <p className="traceability-subtitle">
          Trace submissions through the requirements engineering pipeline
        </p>
      </div>

      <div className="traceability-tabs">
        <button 
          className={`tab-button ${activeView === "trace" ? "active" : ""}`}
          onClick={() => setActiveView("trace")}
        >
          Submission Trace
        </button>
        <button 
          className={`tab-button ${activeView === "overview" ? "active" : ""}`}
          onClick={() => setActiveView("overview")}
        >
          Pipeline Overview
        </button>
      </div>

      {activeView === "trace" && (
        <SubmissionTrace 
          submissions={submissions}
          selectedSubmission={selectedSubmission}
          setSelectedSubmission={setSelectedSubmission}
          getStageData={getStageData}
          truncateText={truncateText}
        />
      )}

      {activeView === "overview" && (
        <PipelineOverview
          submissions={submissions}
          clusters={clusters}
          opinions={opinions}
          divergence={divergence}
          conflicts={conflicts}
          results={results}
        />
      )}
    </div>
  );
}

function SubmissionTrace({ submissions, selectedSubmission, setSelectedSubmission, getStageData, truncateText }) {
  const stageData = selectedSubmission ? getStageData(selectedSubmission) : {};

  return (
    <div className="submission-trace">
      <div className="submission-selector">
        <label htmlFor="submission-select">Select a submission to trace:</label>
        <select 
          id="submission-select"
          value={selectedSubmission?.id || ""}
          onChange={(e) => {
            const submission = submissions.find(s => s.id === e.target.value);
            setSelectedSubmission(submission);
          }}
        >
          <option value="">Choose a submission...</option>
          {submissions.map(submission => (
            <option key={submission.id} value={submission.id}>
              {truncateText(submission.raw_text, 50)}
            </option>
          ))}
        </select>
      </div>

      {selectedSubmission && (
        <div className="trace-pipeline">
          <TraceStage
            title="Submitted"
            icon="📝"
            color="submissions"
            hasData={true}
          >
            <div className="stage-content">
              <p className="full-text">{selectedSubmission.raw_text}</p>
              <div className="meta-info">
                <span><strong>Stakeholder:</strong> {selectedSubmission.stakeholder_name}</span>
                <span><strong>Role:</strong> {selectedSubmission.stakeholder_role}</span>
                <span><strong>Date:</strong> {new Date(selectedSubmission.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </TraceStage>

          <TraceStage
            title="Clustered into"
            icon="🎯"
            color="clusters"
            hasData={!!stageData.cluster}
          >
            {stageData.cluster ? (
              <div className="stage-content">
                <h4>{stageData.cluster.label}</h4>
                <p>{stageData.cluster.summary}</p>
                <span className="cluster-count">{stageData.cluster.submission_count} submissions in this cluster</span>
              </div>
            ) : (
              <p className="no-data">Not yet processed</p>
            )}
          </TraceStage>

          <TraceStage
            title="Opinion Analysis"
            icon="💭"
            color="opinions"
            hasData={!!stageData.opinion}
          >
            {stageData.opinion ? (
              <div className="stage-content">
                <h4>Viewpoint: {stageData.opinion.viewpoint_label}</h4>
                <p>{stageData.opinion.viewpoint_summary}</p>
                <div className="opinion-meta">
                  <span><strong>Stance:</strong> {stageData.opinion.stance}</span>
                  <span><strong>Stakeholder count:</strong> {stageData.opinion.stakeholder_count}</span>
                  {stageData.clusterDivergence && (
                    <span><strong>Divergence score:</strong> {stageData.clusterDivergence.divergence_score?.toFixed(2)}</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="no-data">Not yet processed</p>
            )}
          </TraceStage>

          <TraceStage
            title="Conflicts"
            icon="⚡"
            color="conflicts"
            hasData={stageData.clusterConflicts?.length > 0}
          >
            {stageData.clusterConflicts?.length > 0 ? (
              <div className="stage-content">
                {stageData.clusterConflicts.map(conflict => (
                  <div key={conflict.id} className="conflict-item">
                    <div className="conflict-header">
                      <span className={`severity ${conflict.severity?.toLowerCase()}`}>
                        {conflict.severity}
                      </span>
                      <span className={`status ${conflict.resolved ? 'resolved' : 'unresolved'}`}>
                        {conflict.resolved ? '✅ Resolved' : '⚠️ Unresolved'}
                      </span>
                    </div>
                    <p>{conflict.description}</p>
                    {conflict.resolved && conflict.resolution_note && (
                      <p className="resolution"><strong>Resolution:</strong> {conflict.resolution_note}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No conflicts detected</p>
            )}
          </TraceStage>

          <TraceStage
            title="NFR Impact"
            icon="🔧"
            color="nfrs"
            hasData={true}
          >
            <div className="stage-content">
              <p className="nfr-note">Project-level NFRs ({stageData.nfrs?.length || 0} generated)</p>
              {stageData.nfrs && stageData.nfrs.length > 0 ? (
                <div className="nfr-list">
                  {stageData.nfrs.map(nfr => (
                    <div key={nfr.id} className="nfr-item">
                      <div className="nfr-header">
                        <span className="nfr-category">{nfr.category}</span>
                        <span className={`nfr-status ${nfr.status}`}>{nfr.status}</span>
                      </div>
                      <p className="nfr-description">{nfr.description}</p>
                      {nfr.rationale && (
                        <p className="nfr-rationale"><em>{nfr.rationale}</em></p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nfr-categories">
                  <span className="no-nfrs">No NFRs generated yet</span>
                </div>
              )}
            </div>
          </TraceStage>

          <TraceStage
            title="Priority Ranking"
            icon="🏆"
            color="priority"
            hasData={!!stageData.priorityResult}
          >
            {stageData.priorityResult ? (
              <div className="stage-content">
                <div className="priority-header">
                  <span className="rank">Rank #{stageData.priorityResult.rank}</span>
                  <span className="score">Composite Score: {stageData.priorityResult.priority_score?.toFixed(3)}</span>
                </div>
                <div className="priority-details">
                  <span className="priority-method">Smart prioritization algorithm</span>
                </div>
              </div>
            ) : (
              <p className="no-data">Not yet processed</p>
            )}
          </TraceStage>
        </div>
      )}
    </div>
  );
}

function TraceStage({ title, icon, color, hasData, children }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`trace-stage ${color} ${hasData ? '' : 'no-data'}`}>
      <div 
        className="stage-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="stage-title">
          <span className="stage-icon">{icon}</span>
          <h3>{title}</h3>
        </div>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="stage-body">
          {children}
        </div>
      )}
    </div>
  );
}

function PipelineOverview({ submissions, clusters, opinions, divergence, conflicts, results }) {
  return (
    <div className="pipeline-overview">
      <div className="pipeline-flow">
        {/* Submissions Column */}
        <div className="pipeline-stage">
          <div className="stage-header-overview">
            <span className="stage-icon">📝</span>
            <h3>Submissions</h3>
            <span className="stage-count">{submissions.length}</span>
          </div>
          <div className="stage-nodes">
            <div className="overview-node submissions">
              Total Submissions: {submissions.length}
            </div>
          </div>
        </div>

        <div className="pipeline-arrow">→</div>

        {/* Clusters Column */}
        <div className="pipeline-stage">
          <div className="stage-header-overview">
            <span className="stage-icon">🎯</span>
            <h3>Clusters</h3>
            <span className="stage-count">{clusters.length}</span>
          </div>
          <div className="stage-nodes">
            {clusters.length > 0 ? (
              clusters.slice(0, 5).map(cluster => (
                <div key={cluster.id} className="overview-node clusters">
                  <strong>{cluster.label}</strong>
                  <span>{cluster.submission_count} items</span>
                </div>
              ))
            ) : (
              <div className="overview-node clusters disabled">
                No clusters yet
              </div>
            )}
            {clusters.length > 5 && (
              <div className="overview-node clusters">
                +{clusters.length - 5} more...
              </div>
            )}
          </div>
        </div>

        <div className="pipeline-arrow">→</div>

        {/* Opinions Column */}
        <div className="pipeline-stage">
          <div className="stage-header-overview">
            <span className="stage-icon">💭</span>
            <h3>Opinions</h3>
            <span className="stage-count">{opinions.length}</span>
          </div>
          <div className="stage-nodes">
            {opinions.length > 0 ? (
              opinions.slice(0, 4).map(opinion => {
                const div = divergence.find(d => d.cluster_id === opinion.cluster_id);
                return (
                  <div key={opinion.id} className="overview-node opinions">
                    <strong>{opinion.viewpoint_label}</strong>
                    <span>{opinion.stance}</span>
                    {div && (
                      <span className="divergence">
                        Divergence: {div.divergence_score?.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="overview-node opinions disabled">
                No opinions yet
              </div>
            )}
            {opinions.length > 4 && (
              <div className="overview-node opinions">
                +{opinions.length - 4} more...
              </div>
            )}
          </div>
        </div>

        <div className="pipeline-arrow">→</div>

        {/* Conflicts Column */}
        <div className="pipeline-stage">
          <div className="stage-header-overview">
            <span className="stage-icon">⚡</span>
            <h3>Conflicts</h3>
            <span className="stage-count">{conflicts.length}</span>
          </div>
          <div className="stage-nodes">
            {conflicts.length > 0 ? (
              conflicts.slice(0, 3).map(conflict => (
                <div key={conflict.id} className="overview-node conflicts">
                  <span className={`severity ${conflict.severity?.toLowerCase()}`}>
                    {conflict.severity}
                  </span>
                  <span className={conflict.resolved ? 'resolved' : 'unresolved'}>
                    {conflict.resolved ? '✅' : '⚠️'}
                  </span>
                </div>
              ))
            ) : (
              <div className="overview-node conflicts disabled">
                No conflicts
              </div>
            )}
            {conflicts.length > 3 && (
              <div className="overview-node conflicts">
                +{conflicts.length - 3} more...
              </div>
            )}
          </div>
        </div>

        <div className="pipeline-arrow">→</div>

        {/* Priority Results Column */}
        <div className="pipeline-stage">
          <div className="stage-header-overview">
            <span className="stage-icon">🏆</span>
            <h3>Priority</h3>
            <span className="stage-count">{results.length}</span>
          </div>
          <div className="stage-nodes">
            {results.length > 0 ? (
              results.slice(0, 5).map((result, idx) => {
                const cluster = clusters.find(c => c.id === result.cluster_id);
                return (
                  <div key={result.id} className="overview-node priority">
                    <span className="rank">#{result.rank}</span>
                    <span className="cluster-name">{cluster?.label || 'Unknown'}</span>
                    <span className="score">{result.priority_score?.toFixed(2)}</span>
                  </div>
                );
              })
            ) : (
              <div className="overview-node priority disabled">
                No rankings yet
              </div>
            )}
            {results.length > 5 && (
              <div className="overview-node priority">
                +{results.length - 5} more...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}