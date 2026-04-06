// src/pages/Discussions.jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Discussions.css";

export default function Discussions() {
  const { id: projectId } = useParams();

  const [threads, setThreads] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);

  // Edit modal state
  const [editingThread, setEditingThread] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Delete modal state
  const [deletingThread, setDeletingThread] = useState(null);

  // -------------------------------------------------
  // LOAD USER
  // -------------------------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id || null);
    });
  }, []);

  // -------------------------------------------------
  // LOAD THREADS
  // -------------------------------------------------
  async function loadThreads() {
    const { data, error } = await supabase
      .from("project_threads")
      .select("id, title, created_at, created_by, is_pinned")
      .eq("project_id", projectId)
      .order("is_pinned", { ascending: false }) // pinned first
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErrorMsg("Failed to load discussions.");
      return;
    }

    setThreads(data || []);
  }

  useEffect(() => {
    loadThreads();
  }, [projectId]);

  // -------------------------------------------------
  // CREATE THREAD
  // -------------------------------------------------
  async function createThread() {
    setErrorMsg("");

    if (!newTitle.trim()) return;

    const { error } = await supabase.from("project_threads").insert([
      {
        project_id: projectId,
        title: newTitle.trim(),
        created_by: currentUserId,
      },
    ]);

    if (error) {
      console.error(error);
      setErrorMsg("Failed to create thread.");
      return;
    }

    setNewTitle("");
    setToastMsg("Thread created!");
    setTimeout(() => setToastMsg(""), 2500);
    loadThreads();
  }

  // -------------------------------------------------
  // PIN / UNPIN THREAD
  // -------------------------------------------------
  async function togglePin(thread) {
    const { error } = await supabase
      .from("project_threads")
      .update({ is_pinned: !thread.is_pinned })
      .eq("id", thread.id);

    if (error) {
      console.error(error);
      setErrorMsg("Failed to update pin status.");
      return;
    }

    loadThreads();
  }

  // -------------------------------------------------
  // EDIT THREAD TITLE
  // -------------------------------------------------
  function startEditing(thread) {
    setEditingThread(thread);
    setEditValue(thread.title);
  }

  async function saveEdit() {
    if (!editingThread) return;

    const { error } = await supabase
      .from("project_threads")
      .update({ title: editValue.trim() })
      .eq("id", editingThread.id);

    if (error) {
      console.error(error);
      setErrorMsg("Failed to rename thread.");
      return;
    }

    setEditingThread(null);
    setEditValue("");
    loadThreads();
  }

  // -------------------------------------------------
  // DELETE THREAD
  // -------------------------------------------------
  function confirmDelete(thread) {
    setDeletingThread(thread);
  }

  async function deleteThread() {
    if (!deletingThread) return;

    // Delete all messages inside the thread
    const { error: msgError } = await supabase
      .from("project_messages") // FIXED table name here
      .delete()
      .eq("thread_id", deletingThread.id);

    if (msgError) {
      console.error(msgError);
      setErrorMsg("Failed to delete messages.");
      return;
    }

    // Now delete the thread itself
    const { error: threadError } = await supabase
      .from("project_threads")
      .delete()
      .eq("id", deletingThread.id);

    if (threadError) {
      console.error(threadError);
      setErrorMsg("Failed to delete thread.");
      return;
    }

    setDeletingThread(null);
    loadThreads();
  }

  // -------------------------------------------------
  // FILTERED THREADS
  // -------------------------------------------------
  const filtered = threads.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="discussion-page fade-up">
      <h1 className="dsc-title">Discussions</h1>

      {toastMsg && <div className="toast">{toastMsg}</div>}
      {errorMsg && <p className="error-msg">{errorMsg}</p>}

      {/* SEARCH BAR */}
      <div className="discussion-search">
        <input
          type="text"
          placeholder="Search threads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* CREATE NEW THREAD */}
      <div className="discussion-create">
        <input
          type="text"
          placeholder="Start a new thread..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button className="primary-button" onClick={createThread}>
          Create
        </button>
      </div>

      {/* THREAD LIST */}
      <div className="discussion-list">
        {filtered.length === 0 && <p>No threads found.</p>}

        {filtered.map((t) => (
          <div
            key={t.id}
            className={`discussion-card thread-row ${
              t.is_pinned ? "pinned-thread" : ""
            }`}
          >
            <Link
              to={`/projects/${projectId}/discussions/${t.id}`}
              className="discussion-left"
            >
              <div className="discussion-title">
                {t.title}
                {t.is_pinned && <span className="pin-tag">📌</span>}
              </div>
              <div className="discussion-date">
                {new Date(t.created_at).toLocaleDateString()}
              </div>
            </Link>

            {/* ACTION BUTTONS */}
            <div className="thread-actions">
              <button onClick={() => startEditing(t)}>✏️</button>
              <button onClick={() => togglePin(t)}>
                {t.is_pinned ? "📍" : "📌"}
              </button>
              <button onClick={() => confirmDelete(t)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT MODAL */}
      {editingThread && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Thread Title</h3>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
            <div className="modal-buttons">
              <button onClick={() => setEditingThread(null)}>Cancel</button>
              <button className="primary-button" onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deletingThread && (
        <div className="modal-overlay">
          <div className="modal danger">
            <h3>Delete this thread?</h3>
            <p>This will permanently remove all messages in it.</p>
            <div className="modal-buttons">
              <button onClick={() => setDeletingThread(null)}>Cancel</button>
              <button className="remove-btn" onClick={deleteThread}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
