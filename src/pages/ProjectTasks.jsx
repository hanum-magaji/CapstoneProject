// src/pages/ProjectTasks.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./ProjectTasks.css";

export default function Tasks() {
  const { id: projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [newTask, setNewTask] = useState({
    name: "",
    description: "",
    priority: 2,
    due_date: "",
    requirement_id: null,
    status: "pending",
  });


  // Load tasks
  async function fetchTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error) console.error(error);
    else setTasks(data);
  }

  // Load requirements
  async function fetchRequirements() {
    const { data, error } = await supabase
      .from("requirements")
      .select("id, text")
      .eq("project_id", projectId)
      .order("priority", { ascending: true });

    if (error) console.error(error);
    else setRequirements(data);
  }

  // Add task
  async function addTask() {
    if (!newTask.name.trim()) return;

    const { error } = await supabase.from("tasks").insert([
      {
        project_id: projectId,
        ...newTask,
      },
    ]);

    if (error) console.error(error);
    else {
      setNewTask({
        name: "",
        description: "",
        priority: 2,
        due_date: "",
        requirement_id: null,
        status: "pending",
      });
      fetchTasks();
    }
  }

  // Update task
  async function updateTask(taskId, updates) {
    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) console.error(error);
    else fetchTasks();
  }

  // Delete task
  async function deleteTask(taskId) {
    if (!confirm("Delete this task?")) return;

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) console.error(error);
    else fetchTasks();
  }



  useEffect(() => {
    fetchTasks();
    fetchRequirements();
  }, [projectId]);

  return (
    <div className="tasks-page fade-up">
      <h1 className="fade-up tsk-title">Project Tasks</h1>



      {/* Add Task */}
      <section className="add-task-container fade-up delayed-2">
        <h2>Add New Task</h2>
        <div className="add-task-input">
          <input
            type="text"
            placeholder="Task name..."
            value={newTask.name}
            onChange={(e) =>
              setNewTask({ ...newTask, name: e.target.value })
            }
          />
          <textarea
            placeholder="Description..."
            value={newTask.description}
            onChange={(e) =>
              setNewTask({ ...newTask, description: e.target.value })
            }
          />
          <div className="task-meta">
            <select
              value={newTask.priority}
              onChange={(e) =>
                setNewTask({ ...newTask, priority: parseInt(e.target.value) })
              }
            >
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) =>
                setNewTask({ ...newTask, due_date: e.target.value })
              }
            />
            <select
              value={newTask.requirement_id || ""}
              onChange={(e) =>
                setNewTask({
                  ...newTask,
                  requirement_id: e.target.value || null,
                })
              }
            >
              <option value="">No requirement</option>
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.text}
                </option>
              ))}
            </select>
          </div>
          <select
            value={newTask.status}
            onChange={(e) =>
              setNewTask({ ...newTask, status: e.target.value })
            }
          >
            <option value="pending">Pending</option>
            <option value="in progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <button className="primary-button" onClick={addTask}>
            Add
          </button>
        </div>
      </section>

      {/* Task List */}
      <section className="tasks-list fade-up delayed-3">
        {tasks.length === 0 && <p>No tasks yet.</p>}
        {tasks.map((task) => (
          <div
            className={`task-card ${task.status === "done" ? "done" : ""}`}
            key={task.id}
          >
            <div className="task-title">{task.name}</div>
            <div className="task-description">{task.description}</div>
            <div className="task-meta">
              <span className={`priority-badge p-${task.priority}`}>
                {task.priority === 1
                  ? "High"
                  : task.priority === 2
                  ? "Medium"
                  : "Low"}
              </span>
              <span className="due-date">
                {task.due_date ? `Due: ${task.due_date}` : ""}
              </span>
              {task.requirement_id && (
                <span className="task-requirement">
                  Requirement:{" "}
                  {requirements.find((r) => r.id === task.requirement_id)?.text ||
                    ""}
                </span>
              )}
              <select
                className="status-dropdown"
                value={task.status}
                onChange={(e) => updateTask(task.id, { status: e.target.value })}
              >
                <option value="pending">Pending</option>
                <option value="in progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <button
                className="delete-button"
                onClick={() => deleteTask(task.id)}
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
