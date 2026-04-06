// src/pages/ProjectDetail.jsx
//
// Project overview page. Shows project info, submission stats,
// shareable stakeholder link, and recent submissions.

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./ProjectDetail.css";

export default function ProjectDetail() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [clusterCount, setClusterCount] = useState(0);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [linkCopied, setLinkCopied] = useState(false);

  async function fetchProject() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) console.error(error);
    else setProject(data);
  }

  async function fetchSubmissionStats() {
    // Count total submissions
    const { count, error } = await supabase
      .from("stakeholder_submissions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id);

    if (!error) setSubmissionCount(count || 0);

    // Count clusters
    const { count: cCount, error: cError } = await supabase
      .from("requirement_clusters")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id);

    if (!cError) setClusterCount(cCount || 0);

    // Fetch 5 most recent submissions
    const { data: recent, error: rError } = await supabase
      .from("stakeholder_submissions")
      .select("id, raw_text, stakeholder_name, stakeholder_role, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!rError) setRecentSubmissions(recent || []);
  }

  useEffect(() => {
    fetchProject();
    fetchSubmissionStats();
  }, [id]);

  function getStakeholderLink() {
    if (!project || !project.stakeholder_link_token) return null;
    const base = window.location.origin;
    return `${base}/submit/${project.id}/${project.stakeholder_link_token}`;
  }

  function handleCopyLink() {
    const link = getStakeholderLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (!project) return <p className="loading">Loading project...</p>;

  const stakeholderLink = getStakeholderLink();

  return (
    <div className="project-dashboard-page animate">
      {/* Project Header */}
      <div className="project-header animate delay-1">
        <h2 className="project-overview ovw-title">Project Overview</h2>
        <h1>{project.name}</h1>
        <p>{project.description}</p>
        {project.domain && project.domain !== "other" && (
          <span className="domain-badge">{project.domain}</span>
        )}
      </div>

      {/* Stats Section */}
      <section className="project-stats animate delay-2">
        <div className="stats-cards">
          <div className="stat-card">
            <h3>Submissions</h3>
            <p>{submissionCount}</p>
          </div>
          <div className="stat-card">
            <h3>Clusters</h3>
            <p>{clusterCount}</p>
          </div>
          <div className="stat-card">
            <h3>Status</h3>
            <p>{clusterCount > 0 ? "Clustered" : submissionCount > 0 ? "Collecting" : "New"}</p>
          </div>
        </div>
      </section>

      {/* Stakeholder Submission Link */}
      {stakeholderLink && (
        <section className="stakeholder-link-section animate delay-2">
          <h2>Stakeholder Submission Link</h2>
          <p className="link-description">
            Share this link with stakeholders so they can submit their needs
            and concerns. No account is required.
          </p>
          <div className="link-row">
            <input
              className="link-input"
              type="text"
              value={stakeholderLink}
              readOnly
            />
            <button className="link-copy-btn" onClick={handleCopyLink}>
              {linkCopied ? "Copied" : "Copy Link"}
            </button>
          </div>
        </section>
      )}

      {/* Recent Submissions */}
      <section className="recent-submissions animate delay-3">
        <div className="section-header">
          <h2>Recent Submissions</h2>
          {submissionCount > 0 && (
            <Link to={`/projects/${id}/requirements`} className="view-all-link">
              View all ({submissionCount})
            </Link>
          )}
        </div>

        {recentSubmissions.length === 0 ? (
          <p className="empty-state">
            No submissions yet. Share the stakeholder link to start collecting input.
          </p>
        ) : (
          <div className="submissions-list">
            {recentSubmissions.map((sub) => (
              <div className="submission-card" key={sub.id}>
                <p className="submission-text">
                  {sub.raw_text.length > 200
                    ? sub.raw_text.substring(0, 200) + "..."
                    : sub.raw_text}
                </p>
                <div className="submission-meta">
                  {sub.stakeholder_name && (
                    <span className="submission-author">{sub.stakeholder_name}</span>
                  )}
                  {sub.stakeholder_role && (
                    <span className="submission-role">{sub.stakeholder_role}</span>
                  )}
                  <span className="submission-date">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
