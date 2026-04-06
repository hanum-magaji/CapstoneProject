// src/pages/ProjectSettings.jsx

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./ProjectSettings.css";

export default function ProjectSettings() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load project info
  useEffect(() => {
    async function fetchProject() {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setProject({ name: data.name, description: data.description });
      setLoading(false);
    }

    fetchProject();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ name: project.name, description: project.description })
      .eq("id", id);

    if (error) {
      alert("Error saving project: " + error.message);
    } else {
      alert("Project updated successfully!");
    }

    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this project?")) return;

    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      alert("Error deleting project: " + error.message);
    } else {
      navigate("/projects");
    }
  }

  if (loading) return <p className="loading-text">Loading...</p>;

  return (
    <div className="project-settings-container fade-in">
      <h1 className="settings-title">Project Settings</h1>

      <div className="settings-card fade-up">
        <label>
          Project Name
          <input
            type="text"
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
          />
        </label>

        <label>
          Description
          <textarea
            value={project.description}
            onChange={(e) =>
              setProject({ ...project, description: e.target.value })
            }
          />
        </label>

        <div className="settings-actions">
          <button
            className="primary-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <button className="delete-button" onClick={handleDelete}>
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}
