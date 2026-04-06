// src/pages/Submissions.jsx
//
// Lists stakeholder submissions (Requirements view) for a project.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Submissions.css";

const MAX_GENERATE = 25;

function ShareLinkBanner({ projectId }) {
  const [token, setToken] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchToken() {
      const { data } = await supabase
        .from("projects")
        .select("stakeholder_link_token")
        .eq("id", projectId)
        .single();
      if (data?.stakeholder_link_token) setToken(data.stakeholder_link_token);
    }
    fetchToken();
  }, [projectId]);

  if (!token) return null;

  const shareUrl = `${window.location.origin}/submit/${projectId}/${token}`;

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="share-link-banner">
      <div className="share-link-label">Stakeholder link</div>
      <div className="share-link-row">
        <input
          className="share-link-input"
          readOnly
          value={shareUrl}
          onFocus={(e) => e.target.select()}
        />
        <button className={`share-link-copy ${copied ? "copied" : ""}`} onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function Submissions() {
  const { id: projectId } = useParams();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [projectMeta, setProjectMeta] = useState({ name: "", description: "", domain: "" });
  const [genCount, setGenCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  async function fetchSubmissions() {
    setLoading(true);

    const { data, error } = await supabase
      .from("stakeholder_submissions")
      .select("id, raw_text, stakeholder_name, stakeholder_role, cluster_id, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading submissions:", error);
      setSubmissions([]);
    } else {
      setSubmissions(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    async function loadProject() {
      const { data } = await supabase
        .from("projects")
        .select("name, description, domain")
        .eq("id", projectId)
        .single();
      if (data) setProjectMeta(data);
    }
    loadProject();
  }, [projectId]);

  useEffect(() => {
    fetchSubmissions();
  }, [projectId]);

  const roles = Array.from(
    new Set(submissions.map((s) => s.stakeholder_role).filter(Boolean))
  );

  const filtered = submissions.filter((s) => {
    if (filter !== "all" && s.stakeholder_role !== filter) return false;
    if (search && !s.raw_text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleGenerateMore() {
    const n = Math.min(Math.max(1, parseInt(String(genCount), 10) || 5), MAX_GENERATE);
    setGenerating(true);
    try {
      const res = await fetch("/api/generateRequirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          count: n,
          name: projectMeta.name,
          description: projectMeta.description,
          domain: projectMeta.domain,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body.error || "Generation failed.");
        return;
      }
      await fetchSubmissions();
    } catch (e) {
      alert(e?.message || "Network error.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="submissions-page">
        <p className="submissions-loading-text">Loading requirements…</p>
      </div>
    );
  }

  return (
    <div className="submissions-page">
      <div className="submissions-header">
        <div>
          <p className="submissions-eyebrow">Project</p>
          <h1>Requirements</h1>
          <p className="submissions-lead">
            Stakeholder input and AI-generated items. Share the link or generate more below.
          </p>
        </div>
        <span className="submissions-count">{submissions.length} total</span>
      </div>

      <ShareLinkBanner projectId={projectId} />

      <section className="submissions-generate">
        <h2 className="submissions-generate-title">Generate more</h2>
        <p className="submissions-generate-hint">
          Uses your project name, description, and domain to suggest additional requirements (saved like stakeholder submissions).
        </p>
        <div className="submissions-generate-row">
          <label className="submissions-generate-label">
            Count
            <input
              type="number"
              min={1}
              max={MAX_GENERATE}
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="submissions-generate-input"
            />
          </label>
          <button
            type="button"
            className="submissions-generate-btn"
            disabled={generating}
            onClick={handleGenerateMore}
          >
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      </section>

      <div className="submissions-filters">
        <input
          type="text"
          className="submissions-search"
          placeholder="Search requirements…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="submissions-role-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="submissions-empty">
          {submissions.length === 0
            ? "No requirements yet. Share the stakeholder link or use Generate above."
            : "No requirements match the current filters."}
        </p>
      ) : (
        <div className="submissions-list">
          {filtered.map((sub) => (
            <div
              className={`submission-item ${sub.cluster_id ? "clustered" : ""}`}
              key={sub.id}
            >
              <p className="submission-item-text">{sub.raw_text}</p>
              <div className="submission-item-meta">
                {sub.stakeholder_name && (
                  <span className="meta-name">{sub.stakeholder_name}</span>
                )}
                {sub.stakeholder_role && (
                  <span className="meta-role">{sub.stakeholder_role}</span>
                )}
                <span className="meta-status">
                  {sub.cluster_id ? "Clustered" : "Unclustered"}
                </span>
                <span className="meta-date">
                  {new Date(sub.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
