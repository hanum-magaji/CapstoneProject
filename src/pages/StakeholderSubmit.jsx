// src/pages/StakeholderSubmit.jsx
//
// Public-facing submission form for stakeholders.
// Accessed via a shareable link: /submit/:projectId/:token
// No login required.

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./StakeholderSubmit.css";

const ROLE_OPTIONS = [
  "Resident",
  "City Planner",
  "Transit User",
  "Business Owner",
  "Government Official",
  "Student",
  "Community Organizer",
  "Other",
];

export default function StakeholderSubmit() {
  const { projectId, token } = useParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");

  // Load project info to display context to the stakeholder
  useEffect(() => {
    async function loadProject() {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, domain, stakeholder_link_token")
        .eq("id", projectId)
        .single();

      if (error || !data) {
        setErrorMsg("This submission link is not valid.");
        setLoading(false);
        return;
      }

      if (data.stakeholder_link_token !== token) {
        setErrorMsg("This submission link is not valid.");
        setLoading(false);
        return;
      }

      setProject(data);
      setLoading(false);
    }

    loadProject();
  }, [projectId, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!text.trim() || text.trim().length < 10) {
      setErrorMsg("Please describe your needs in at least 10 characters.");
      return;
    }

    if (text.length > 5000) {
      setErrorMsg("Submission must not exceed 5000 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          link_token: token,
          raw_text: text.trim(),
          stakeholder_name: name.trim() || null,
          stakeholder_role: role || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result.error || "Submission failed. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Submission error:", err);
      setErrorMsg("Network error. Please check your connection and try again.");
    }

    setSubmitting(false);
  }

  function handleSubmitAnother() {
    setSubmitted(false);
    setText("");
    setErrorMsg("");
  }

  // --- Loading state ---

  if (loading) {
    return (
      <div className="submit-container">
        <div className="submit-card">
          <p className="submit-loading">Loading...</p>
        </div>
      </div>
    );
  }

  // --- Invalid link ---

  if (errorMsg && !project) {
    return (
      <div className="submit-container">
        <div className="submit-card">
          <h1 className="submit-title">Link Not Valid</h1>
          <p className="submit-error-text">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // --- Submission confirmed ---

  if (submitted) {
    return (
      <div className="submit-container">
        <div className="submit-card">
          <h1 className="submit-title">Thank You</h1>
          <p className="submit-body">
            Your input has been recorded and will be reviewed by the project team.
          </p>
          <button className="submit-btn" onClick={handleSubmitAnother}>
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }

  // --- Submission form ---

  return (
    <div className="submit-container">
      <div className="submit-card">
        <h1 className="submit-title">{project.name}</h1>
        {project.description && (
          <p className="submit-description">{project.description}</p>
        )}
        {project.domain && project.domain !== "other" && (
          <span className="submit-domain-badge">{project.domain}</span>
        )}

        <hr className="submit-divider" />

        <h2 className="submit-subtitle">Share Your Input</h2>
        <p className="submit-body">
          Describe your needs, ideas, or concerns related to this project.
          Your input will help shape the requirements and priorities.
        </p>

        <form onSubmit={handleSubmit} className="submit-form">
          <div className="submit-field">
            <label htmlFor="stakeholder-name">Your Name (optional)</label>
            <input
              id="stakeholder-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How you would like to be identified"
              maxLength={100}
            />
          </div>

          <div className="submit-field">
            <label htmlFor="stakeholder-role">Your Role (optional)</label>
            <select
              id="stakeholder-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Select a role...</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r.toLowerCase()}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="submit-field">
            <label htmlFor="stakeholder-text">
              Your Input <span className="submit-required">*</span>
            </label>
            <textarea
              id="stakeholder-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe what you need, what problems you face, or what improvements you would like to see..."
              rows={6}
              maxLength={5000}
              required
            />
            <span className="submit-char-count">{text.length} / 5000</span>
          </div>

          {errorMsg && <p className="submit-error-text">{errorMsg}</p>}

          <button
            type="submit"
            className="submit-btn"
            disabled={submitting || !text.trim()}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
