// src/pages/CreateProject.jsx

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./CreateProject.css";

const DOMAIN_OPTIONS = [
  { value: "transit", label: "Public Transit" },
  { value: "e-permitting", label: "E-Permitting" },
  { value: "civic-engagement", label: "Civic Engagement" },
  { value: "public-safety", label: "Public Safety" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "environment", label: "Environment" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];

function generateToken() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function CreateProject() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("other");
  const [loading, setLoading] = useState(false);
  const [generateInitial, setGenerateInitial] = useState(false);
  const [seedCount, setSeedCount] = useState(5);

  async function handleCreateProject() {
    if (!name) return alert("Project name is required.");
    if (!session?.user?.id) return alert("You must be logged in.");

    setLoading(true);

    const linkToken = generateToken();

    const { data: project, error } = await supabase
      .from("projects")
      .insert([
        {
          name,
          description,
          domain,
          stakeholder_link_token: linkToken,
          owner_user_id: session.user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      setLoading(false);
      return alert("Failed to create project.");
    }

    if (generateInitial && description.trim()) {
      const n = Math.min(Math.max(1, parseInt(String(seedCount), 10) || 5), 25);
      try {
        const res = await fetch("/api/generateRequirements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: project.id,
            count: n,
            name,
            description,
            domain,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn("Initial generation failed:", body.error || res.status);
        }
      } catch (e) {
        console.warn("Initial generation request failed:", e);
      }
    }

    setLoading(false);
    navigate(`/projects/${project.id}`);
  }

  return (
    <div className="create-container fade-in">
      <div className="create-inner fade-up">
        <h1 className="create-title">Create New Project</h1>
        <p className="create-subtitle">
          Define your project. Once created, you can share a link for
          stakeholders to submit their needs and ideas.
        </p>

        <div className="create-card">
          <label className="input-label">Project Name</label>
          <input
            className="input-field"
            placeholder="e.g., Smart Transit Tracking Portal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="input-label">Description</label>
          <textarea
            className="textarea-field"
            rows={4}
            placeholder="Describe the goals and scope of this project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="input-label">Domain</label>
          <select
            className="input-field"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            {DOMAIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="create-generate-row">
            <input
              type="checkbox"
              checked={generateInitial}
              onChange={(e) => setGenerateInitial(e.target.checked)}
            />
            <span>Generate initial requirements with AI (uses title &amp; description)</span>
          </label>
          {generateInitial && (
            <label className="input-label">
              How many
              <input
                type="number"
                className="input-field"
                min={1}
                max={25}
                value={seedCount}
                onChange={(e) => setSeedCount(Number(e.target.value))}
                style={{ marginTop: "0.5rem" }}
              />
            </label>
          )}

          <div className="create-buttons">
            <button
              className="btn primary"
              disabled={loading}
              onClick={handleCreateProject}
            >
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
