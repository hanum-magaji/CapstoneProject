import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./ProjectCalendar.css";

export default function ProjectCalendar() {
  const { id: projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("calendar"); // calendar | timeline | roadmap
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
 });

  async function fetchTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("due_date", { ascending: true });

    if (error) console.error(error);
    else setTasks(data);
  }

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  // --- Helper functions ---
  const getCalendarDays = () => {
  const { year, month } = currentMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));
  return days;
};


  const prevMonth = () => {
  setCurrentMonth((c) => {
    const date = new Date(c.year, c.month - 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
};

const nextMonth = () => {
  setCurrentMonth((c) => {
    const date = new Date(c.year, c.month + 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
};


  // Group tasks by date (normalize to YYYY-MM-DD)
const groupedByDate = tasks.reduce((acc, task) => {
  if (task.due_date) {
    const dateKey = task.due_date.slice(0, 10); // YYYY-MM-DD
    acc[dateKey] = acc[dateKey] || [];
    acc[dateKey].push(task);
  }
  return acc;
}, {});

  const CalendarView = () => {
  const days = getCalendarDays();

  return (
    <div className="calendar-container fade-up">
      <div className="calendar-header">
        <button onClick={prevMonth} className="nav-month-btn">◀</button>
        <span>{`${currentMonth.year} - ${currentMonth.month + 1}`}</span>
        <button onClick={nextMonth} className="nav-month-btn">▶</button>
      </div>

      <div className="calendar-grid">
        {days.map((day, i) => {
          const dateStr = day ? day.toISOString().slice(0, 10) : null;
          const tasksForDay = day ? groupedByDate[dateStr] : [];

          return (
            <div key={i} className="calendar-cell">
              {day && (
                <>
                  <div className="calendar-date">{day.getDate()}</div>
                  <div className="calendar-tasks">
                    {tasksForDay?.map((t) => (
                      <div key={t.id} className={`task-dot p-${t.priority}`}>
                        {t.name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

  const TimelineView = () => {
    if (tasks.length === 0)
      return <p className="no-tasks fade-up">No tasks with due dates.</p>;

    return (
      <div className="timeline-container fade-up">
        {tasks.map((t) => (
          <div key={t.id} className="timeline-item">
            <div className="timeline-marker" />
            <div className="timeline-content">
              <div className="timeline-date">{t.due_date || "No date"}</div>
              <div className="timeline-title">{t.name}</div>
              <div className="timeline-desc">{t.description}</div>

              <span className={`priority-badge p-${t.priority}`}>
                {t.priority === 1 ? "High" : t.priority === 2 ? "Medium" : "Low"}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };
  const RoadmapView = () => {
    if (tasks.length === 0)
      return <p className="no-tasks fade-up">No tasks yet.</p>;

    return (
      <div className="roadmap-container fade-up">
        {tasks.map((t) => (
          <div key={t.id} className="roadmap-row">
            <div className="roadmap-task-info">
              <div className="roadmap-task-title">{t.name}</div>
              <div className="roadmap-date">{t.due_date}</div>
            </div>

            <div className="roadmap-line">
              <div className={`roadmap-point p-${t.priority}`} />
            </div>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div className="calendar-page fade-in">
      <h1 className="fade-up tml-title">Project Timeline</h1>

      {/* Toggle Buttons */}
      <div className="view-toggle fade-up">
  <button
    className={`toggle-btn-square ${view === "calendar" ? "active" : ""}`}
    onClick={() => setView("calendar")}
    title="Calendar"
  >
    📅
  </button>
  <button
    className={`toggle-btn-square ${view === "timeline" ? "active" : ""}`}
    onClick={() => setView("timeline")}
    title="Timeline"
  >
    🕒
  </button>
  <button
    className={`toggle-btn-square ${view === "roadmap" ? "active" : ""}`}
    onClick={() => setView("roadmap")}
    title="Roadmap"
  >
    🛣️
  </button>
</div>


      {/* Render selected view */}
      {view === "calendar" && <CalendarView />}
      {view === "timeline" && <TimelineView />}
      {view === "roadmap" && <RoadmapView />}
    </div>
  );
}
