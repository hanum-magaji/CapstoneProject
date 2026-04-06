// src/pages/Inbox.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Inbox.css";

export default function Inbox() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  /* --------------------------------------------------------
     Load pending invitations
  -------------------------------------------------------- */
  async function loadInvites() {
    if (!session?.user?.id) return;

    const { data: collabRows, error } = await supabase
      .from("project_collaborators")
      .select("project_id, role")
      .eq("user_id", session.user.id)
      .eq("role", "pending");

    if (error) {
      console.error(error);
      setInvites([]);
      setLoading(false);
      return;
    }

    if (!collabRows || collabRows.length === 0) {
      setInvites([]);
      setLoading(false);
      return;
    }

    const projectIds = collabRows.map((c) => c.project_id);

    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, description, owner_user_id")
      .in("id", projectIds);

    const merged = collabRows.map((collab) => ({
      ...collab,
      project: projects.find((p) => p.id === collab.project_id),
    }));

    setInvites(merged);
    setLoading(false);
  }

  /* --------------------------------------------------------
     Accept invite
  -------------------------------------------------------- */
  async function acceptInvite(project_id) {
    const { error } = await supabase
      .from("project_collaborators")
      .update({ role: "collaborator" })
      .eq("project_id", project_id)
      .eq("user_id", session.user.id);

    if (error) {
      alert("Failed to accept invite.");
      console.error(error);
      return;
    }

    navigate(`/projects/${project_id}`);
  }

  useEffect(() => {
    loadInvites();
  }, []);

  return (
    <div className="inbox-container fade-in">
      <div className="inbox-header fade-up">
        <h1 className="inbox-title">Inbox</h1>
        <p className="inbox-subtitle">Project invitations awaiting your response.</p>
      </div>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : invites.length === 0 ? (
        <p className="no-invites">You have no pending invitations.</p>
      ) : (
        <div className="invites-grid fade-up">
          {invites.map((inv) => (
            <div className="invite-card" key={inv.project_id}>
              <h2 className="invite-project-name">{inv.project?.name}</h2>
              <p className="invite-description">{inv.project?.description}</p>

              <div className="invite-buttons">
                <button
                  className="btn secondary"
                  onClick={() => navigate(`/projects/${inv.project_id}`)}
                >
                  View Project
                </button>

                <button
                  className="btn primary"
                  onClick={() => acceptInvite(inv.project_id)}
                >
                  Accept Invite
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
