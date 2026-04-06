// src/pages/Dashboard.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [collabCount, setCollabCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);

  /* --------------------------------------------------------
     Load user profile
  -------------------------------------------------------- */
  async function loadUser() {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from("users")
      .select("first_name, last_name, email")
      .eq("id", session.user.id)
      .single();

    if (!error) setUserData(data);
  }

  /* --------------------------------------------------------
     Load user projects
  -------------------------------------------------------- */
  async function loadProjects() {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_user_id", session.user.id)
      .order("created_at", { ascending: false });

    setProjects(data || []);
  }

  /* --------------------------------------------------------
     Load collaborator stats
  -------------------------------------------------------- */
  async function loadCollaboratorStats() {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from("project_collaborators")
      .select("role")
      .eq("user_id", session.user.id);

    if (!data) return;

    setCollabCount(data.length);
    setPendingInvites(data.filter((x) => x.role === "pending").length);
  }

  useEffect(() => {
    loadUser();
    loadProjects();
    loadCollaboratorStats();
  }, []);

  return (
    <div className="dashboard-container fade-in">
      {/* Header */}
      <div className="dashboard-header fade-up">
        <h1 className="dashboard-title">
          Welcome{userData?.first_name ? `, ${userData.first_name}` : ""} 👋
        </h1>
        <p className="dashboard-subtitle">
          Here's an overview of your work and activity.
        </p>
      </div>

      {/* Stats Row */}
      <div className="stats-grid fade-up">
        <div className="stat-card">
          <h2>{projects.length}</h2>
          <p>Projects Created</p>
        </div>

        <div className="stat-card">
          <h2>{collabCount}</h2>
          <p>Projects You're Collaborating On</p>
        </div>

        <div className="stat-card">
          <h2>{pendingInvites}</h2>
          <p>Pending Invitations</p>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="recent-projects-section fade-up">
        <div className="recent-header">
          <h2>Recent Projects</h2>
          <button
            onClick={() => navigate("/projects/new")}
            className="create-project-button"
          >
            + New Project
          </button>
        </div>

        <div className="recent-projects-grid">
          {projects.length === 0 ? (
            <p className="no-projects">You haven't created any projects yet.</p>
          ) : (
            projects.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="project-card"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <h3 className="project-name">{p.name}</h3>
                <p className="project-description">{p.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
