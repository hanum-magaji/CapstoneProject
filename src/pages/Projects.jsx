// src/pages/Projects.jsx

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Projects.css";

export default function Projects() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");

  async function fetchProjects() {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    /* --------------------------------------------------------
       1. Fetch owned projects
    -------------------------------------------------------- */
    const { data: owned } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    const ownedWithRole = (owned || []).map((p) => ({
      ...p,
      _role: "owner",
    }));

    /* --------------------------------------------------------
       2. Fetch collaborator project ids (role = collaborator)
    -------------------------------------------------------- */
    const { data: collabRows } = await supabase
      .from("project_collaborators")
      .select("project_id")
      .eq("user_id", userId)
      .eq("role", "collaborator");

    let collaboratorProjects = [];

    if (collabRows?.length > 0) {
      const ids = collabRows.map((c) => c.project_id);

      const { data: projs } = await supabase
        .from("projects")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });

      collaboratorProjects = (projs || []).map((p) => ({
        ...p,
        _role: "collaborator",
      }));
    }

    /* --------------------------------------------------------
       3. Merge + dedupe
    -------------------------------------------------------- */
    const combined = [...ownedWithRole, ...collaboratorProjects];

    const unique = Array.from(
      new Map(combined.map((p) => [p.id, p])).values()
    );

    setProjects(unique);
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  /* --------------------------------------------------------
     Dynamic Search Filtering
  -------------------------------------------------------- */
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;

    const s = search.toLowerCase();

    return projects.filter((p) =>
      p.name.toLowerCase().includes(s)
    );
  }, [search, projects]);

  return (
    <div className="projects-container fade-in">
      <div className="projects-header fade-up">
        <h1 className="projects-title">Your Projects</h1>
        <p className="projects-subtitle">
          Manage your projects or join collaborations easily.
        </p>

        <button 
          className="create-project-button"
          onClick={() => navigate("/projects/new")}
        >
          + Create New Project
        </button>
      </div>

      {/* Search Bar */}
      <div className="project-search-container fade-up">
        <input
          className="project-search"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="projects-grid fade-up">
        {filteredProjects.length === 0 ? (
          <p className="no-projects">
            No matching projects found.
          </p>
        ) : (
          filteredProjects.map((p) => (
            <div
              key={p.id}
              className="project-card"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <div className="project-card-header">
                <h3 className="project-name">{p.name}</h3>

                <span
                  className={`role-badge ${
                    p._role === "owner" ? "owner" : "collab"
                  }`}
                >
                  {p._role === "owner" ? "Owner" : "Collaborator"}
                </span>
              </div>

              <p className="project-description">{p.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
