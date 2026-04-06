// src/pages/Settings.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Settings.css";

export default function Settings() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [user, setUser] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [uploading, setUploading] = useState(false);

  // -------------------------------------------------------
  // Load User
  // -------------------------------------------------------

  useEffect(() => {
    async function loadUser() {
    if (!session?.user?.id) return;
      const { data, error } = await supabase
  .from("users")
  .select("*")
  .eq("id", session.user.id)
  .single();


      if (error || !data) {
        navigate("/");
        return;
      }

      const u = data;
      setUser(u);

      setFirstName(u.first_name || "");
      setLastName(u.last_name || "");
      setAvatarUrl(u.avatar_url || "");
    }

    loadUser();
  }, []);

  // -------------------------------------------------------
  // Save Profile Changes
  // -------------------------------------------------------
  
  async function saveChanges() {

    const { error } = await supabase
      .from("users")
      .update({ first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl })
      .eq("id", user.id);

    if (error) {
      alert("Error saving project: " + error.message);
    } else {
      alert("Project updated successfully!");
    }

  }

  // -------------------------------------------------------
  // Avatar Upload
  // -------------------------------------------------------
  async function uploadAvatar(e) {
    try {
      setUploading(true);
      const file = e.target.files[0];
      if (!file) return;

      const ext = file.name.split(".").pop();
      const filePath = `${user.id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(urlData.publicUrl);
      alert("Avatar uploaded!");
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  // -------------------------------------------------------
  // Delete Account
  // -------------------------------------------------------
  async function deleteAccount() {
    if (!confirm("Are you sure? This action is permanent.")) return;

    const { error } = await supabase.auth.admin.deleteUser(user.id);

    if (error) {
      alert("Error deleting account: " + error.message);
      return;
    }

    await supabase.auth.signOut();
    navigate("/");
  }

  // -------------------------------------------------------
  // Logout
  // -------------------------------------------------------
  async function logout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (!user) return <p className="loading">Loading...</p>;

  return (
    <div className="settings-page">

      {/* Header */}
      <header className="settings-header fade-in">
        <h1 className="settings-title">Account Settings</h1>
        <p className="settings-subtitle">Manage your profile and account</p>
      </header>

      {/* Main Grid */}
      <div className="settings-grid fade-up">

        <div className="settings-card">
          <h2>Profile Information</h2>

          <label>
            First Name
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>

          <label>
            Last Name
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>

          <button className="primary-button" onClick={saveChanges}>
            Save Changes
          </button>
        </div>

        <div className="settings-card">
          <h2>Profile Picture</h2>

          {avatarUrl ? (
            <img src={avatarUrl} className="avatar-preview" alt="avatar" />
          ) : (
            <div className="avatar-placeholder">No Avatar</div>
          )}

          <label>
            Upload New Image
            <input
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-danger fade-up">
        <h3>Danger Zone</h3>

        <div className="danger-buttons">
          <button className="delete-button" onClick={deleteAccount}>
            Delete Account
          </button>

          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}