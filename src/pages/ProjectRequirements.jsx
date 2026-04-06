// src/pages/ProjectRequirements.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./ProjectRequirements.css";

export default function Requirements() {
  const { id: projectId } = useParams();
  const [requirements, setRequirements] = useState([]);
  const [newRequirement, setNewRequirement] = useState({
    text: "",
    priority: 2,
    status: "pending",
  });
  const [aiPrompt, setAiPrompt] = useState("");

  // Load requirements
  async function fetchRequirements() {
    const { data, error } = await supabase
      .from("requirements")
      .select("*")
      .eq("project_id", projectId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) console.error(error);
    else setRequirements(data);
  }

  // Add requirement
  async function addRequirement() {
    if (!newRequirement.text.trim()) return;

    const { error } = await supabase.from("requirements").insert([
      {
        project_id: projectId,
        ...newRequirement,
      },
    ]);

    if (error) console.error(error);
    else {
      setNewRequirement({ text: "", priority: 2, status: "pending" });
      fetchRequirements();
    }
  }

  // Update requirement
  async function updateRequirement(reqId, updates) {
    const { error } = await supabase
      .from("requirements")
      .update(updates)
      .eq("id", reqId);

    if (error) console.error(error);
    else fetchRequirements();
  }

  // Delete requirement
  async function deleteRequirement(reqId) {
    if (!confirm("Delete this requirement?")) return;

    const { error } = await supabase.from("requirements").delete().eq("id", reqId);
    if (error) console.error(error);
    else fetchRequirements();
  }

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;

    let res;
    try {
      res = await fetch("/api/editRequirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, prompt: aiPrompt }),
      });
    } catch (err) {
      alert("Network error: " + err.message);
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    let result;

    try {
      result = contentType.includes("application/json")
        ? await res.json()
        : await res.text();
    } catch {
      alert("Invalid server response.");
      return;
    }

    if (!res.ok || result.error) {
      alert("AI Error: " + (result.error || "Unknown"));
      return;
    }

    setAiPrompt("");
    fetchRequirements();
  };

  useEffect(() => {
    fetchRequirements();
  }, [projectId]);

  return (
    <div className="requirements-page fade-up">
      <p className="req-eyebrow">Structured checklist</p>
      <h1 className="req-title fade-up">Spec</h1>
      <p className="req-lead">
        Editable requirement lines stored in your project (separate from stakeholder requirements).
      </p>

      {/* AI Section */}
      <section className="ai-assistant fade-up delayed-1">
        <h2>AI Requirement Assistant</h2>
        <p className="ai-description">
          Ask the AI to add, edit, improve, reprioritize, or clean up your requirements.
        </p>

        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Try: “Reword everything to be more formal” or “Add 5 risk-related requirements.”"
          rows={4}
        />

        <button className="primary-button ai-button" onClick={handleAiEdit}>
          Send to AI
        </button>
      </section>

      {/* Add Requirement */}
      <section className="add-requirement-container fade-up delayed-2">
        <h2>Add New Requirement</h2>
        <div className="add-requirement-input">
          <input
            type="text"
            placeholder="Requirement text..."
            value={newRequirement.text}
            onChange={(e) =>
              setNewRequirement({ ...newRequirement, text: e.target.value })
            }
          />
          <div className="requirement-meta">
            <select
              value={newRequirement.priority}
              onChange={(e) =>
                setNewRequirement({
                  ...newRequirement,
                  priority: parseInt(e.target.value),
                })
              }
            >
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </div>
          <button className="primary-button" onClick={addRequirement}>
            Add
          </button>
        </div>
      </section>

      {/* Requirements List */}
      <section className="requirements-list fade-up delayed-3">
        {requirements.length === 0 && <p>No requirements yet.</p>}
        {requirements.map((req) => (
          <div className="requirement-card" key={req.id}>
            <div className="requirement-text">{req.text}</div>
            <div className="requirement-meta">
              <span className={`priority-badge p-${req.priority}`}>
                {req.priority === 1
                  ? "High"
                  : req.priority === 2
                  ? "Medium"
                  : "Low"}
              </span>

              {/* <button
                className={
                  req.status === "done"
                    ? "status-toggle done"
                    : "status-toggle pending"
                }
                onClick={() =>
                  updateRequirement(req.id, {
                    status: req.status === "pending" ? "done" : "pending",
                  })
                }
              >
                {req.status}
              </button> */}

              <button
                className="delete-button"
                onClick={() => deleteRequirement(req.id)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
