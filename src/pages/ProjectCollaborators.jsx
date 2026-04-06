// src/pages/ProjectCollaborators.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./ProjectCollaborators.css";

const DEFAULT_AVATAR = "/default-avatar.png";

export default function ProjectCollaborators() {
  const { id: projectId } = useParams();
  const [collaborators, setCollaborators] = useState([]);
  const [projectOwnerId, setProjectOwnerId] = useState(null);
  const [projectOwnerEmail, setProjectOwnerEmail] = useState("");
  const [projectOwnerFirstName, setProjectOwnerFirstName] = useState("");
  const [projectOwnerLastName, setProjectOwnerLastName] = useState("");
  const [projectOwnerAvatar, setProjectOwnerAvatar] = useState("");
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);

  // ---------------------------------------------------------
  // LOAD CURRENT USER
  // ---------------------------------------------------------
  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data?.user?.id || null);
  }

  // ---------------------------------------------------------
  // LOAD PROJECT OWNER
  // ---------------------------------------------------------
  async function fetchProjectOwner() {
    const { data, error } = await supabase
      .from("projects")
      .select("owner_user_id")
      .eq("id", projectId)
      .single();

    if (error) console.error("Error fetching project:", error);
    else setProjectOwnerId(data?.owner_user_id);

    // fetch owner's email for display
    if (data?.owner_user_id) {
      const { data: ownerData, error: ownerError } = await supabase
        .from("users")
        .select("email, first_name, last_name, avatar_url")
        .eq("id", data.owner_user_id)
        .maybeSingle();

      if (ownerError) console.error("Error fetching owner email:", ownerError);
      else {
        setProjectOwnerEmail(ownerData?.email || "");
        setProjectOwnerFirstName(ownerData?.first_name || "");
        setProjectOwnerLastName(ownerData?.last_name || "");
        setProjectOwnerAvatar(ownerData?.avatar_url || DEFAULT_AVATAR);
      }
    }
  }

  // ---------------------------------------------------------
  // LOAD COLLABORATORS (manual join with public.users)
  // ---------------------------------------------------------
  async function fetchCollaborators() {
    try {
      const { data: collabData, error: collabError } = await supabase
        .from("project_collaborators")
        .select("user_id, role")
        .eq("project_id", projectId);

      if (collabError) throw collabError;
      if (!collabData) return setCollaborators([]);

      const userIds = collabData.map((c) => c.user_id);

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, avatar_url, created_at")
        .in("id", userIds);

      if (usersError) throw usersError;

      const merged = collabData.map((c) => {
        const user = usersData.find((u) => u.id === c.user_id);
        return {
          user_id: c.user_id,
          role: c.role,
          email: user?.email,
          first_name: user?.first_name,
          last_name: user?.last_name,
          avatar_url: user?.avatar_url || DEFAULT_AVATAR,
          created_at: user?.created_at,
        };
      });

      setCollaborators(merged);
    } catch (err) {
      console.error("Error fetching collaborators:", err);
      setErrorMsg("Failed to load collaborators.");
    }
  }

  // ---------------------------------------------------------
  // INVITE NEW COLLABORATOR
  // ---------------------------------------------------------
  async function inviteCollaborator() {
    setErrorMsg("");
    if (!inviteEmail.trim()) return;

    const { data: user, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("Error fetching user:", error);
      setErrorMsg("Failed to check user existence.");
      return;
    }

    if (!user) {
      setErrorMsg("No such email exists.");
      return;
    }

    // Prevent inviting the project creator
    if (user.id === projectOwnerId) {
      setErrorMsg("User is already a collaborator.");
      return;
    }

    const already = collaborators.find((c) => c.user_id === user.id);
    if (already) {
      setErrorMsg("User is already a collaborator.");
      return;
    }

    const { error: insertError } = await supabase
      .from("project_collaborators")
      .insert([{ project_id: projectId, user_id: user.id, role: "pending" }]);

    if (insertError) {
      console.error("Error inviting collaborator:", insertError);
      setErrorMsg("Failed to invite collaborator.");
      return;
    }

    setInviteEmail("");
    fetchCollaborators();
    setToastMsg(`Invitation sent to ${user.email}`);
    setTimeout(() => setToastMsg(""), 3000);
  }

  // ---------------------------------------------------------
  // REMOVE COLLABORATOR
  // ---------------------------------------------------------
  async function removeCollaborator(userId) {
    if (!confirm("Remove this collaborator?")) return;

    const { error } = await supabase
      .from("project_collaborators")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error removing collaborator:", error);
      setErrorMsg("Failed to remove collaborator.");
      return;
    }

    fetchCollaborators();
    setToastMsg("Collaborator removed");
    setTimeout(() => setToastMsg(""), 3000);
  }

  // ---------------------------------------------------------
  useEffect(() => {
    loadUser();
    fetchProjectOwner();
    fetchCollaborators();
  }, [projectId]);

  // ---------------------------------------------------------
  const filtered = collaborators.filter((c) =>
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="collab-page fade-up">
      <h1 className="fade-up clb-title">Collaborators</h1>

      {toastMsg && <div className="toast">{toastMsg}</div>}

      <div className="collab-search fade-up delayed-1">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="collab-invite fade-up delayed-2">
        <input
          type="email"
          placeholder="Invite collaborator by email..."
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <button className="primary-button" onClick={inviteCollaborator}>
          Invite
        </button>
      </div>

      {errorMsg && <p className="error-msg">{errorMsg}</p>}

      <div className="collab-list fade-up delayed-3">
        {/* Creator tile */}
        {projectOwnerId && (
          <div className="collab-card" key={projectOwnerId}>
            <img
              src={projectOwnerAvatar || DEFAULT_AVATAR}
              alt={`${projectOwnerFirstName || ""} ${projectOwnerLastName || ""}`}
              className="collab-avatar"
            />
            <div className="collab-email">{projectOwnerEmail}</div>
            <span className="collab-role creator">Creator</span>
          </div>
        )}

        {/* Collaborator tiles */}
        {filtered.length === 0 && <p>No collaborators found.</p>}
        {filtered.map((c) => (
          <div className="collab-card" key={c.user_id}>
            <img
              src={c.avatar_url || DEFAULT_AVATAR}
              alt={`${c.first_name || ""} ${c.last_name || ""}`}
              className="collab-avatar"
            />
            <div className="collab-email">{c.email}</div>
            <span className={`collab-role ${c.role}`}>{c.role}</span>
            {currentUserId === projectOwnerId && projectOwnerId !== c.user_id && (
              <button
                className="remove-btn"
                onClick={() => removeCollaborator(c.user_id)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
