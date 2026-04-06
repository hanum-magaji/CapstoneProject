// src/components/ProjectSidebar.jsx
import { Link, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./ProjectSidebar.css";

export default function ProjectSidebar() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const { session } = useAuth();
  const [project, setProject] = useState(null);
  const active = (segment) => pathname.includes(segment);

  useEffect(() => {
    async function fetchProject() {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        console.error("Error fetching project:", error);
      } else {
        setProject(data);
      }
    }
    fetchProject();
  }, [id]);

  const isOwner = project?.owner_user_id === session?.user?.id;

  return (
    <aside className="project-sidebar">
      <h3 className="project-sidebar-title">Project</h3>
      <Link
        to={`/projects/${id}`}
        className={pathname === `/projects/${id}` ? "side-item active" : "side-item"}
      >
        Overview
      </Link>

      <div className="sidebar-section-label">Requirements</div>
      <Link
        to={`/projects/${id}/requirements`}
        className={active("requirements") && !active("visualization") && !active("spec") ? "side-item active" : "side-item"}
      >
        Requirements
      </Link>
      <Link
        to={`/projects/${id}/spec`}
        className={active("spec") ? "side-item active" : "side-item"}
      >
        Spec
      </Link>
      <Link
        to={`/projects/${id}/visualization`}
        className={active("visualization") ? "side-item active" : "side-item"}
      >
        Visualization
      </Link>
      <Link
        to={`/projects/${id}/clusters`}
        className={active("clusters") ? "side-item active" : "side-item"}
      >
        Clusters
      </Link>
      <Link
        to={`/projects/${id}/conflicts`}
        className={active("conflicts") ? "side-item active" : "side-item"}
      >
        Conflicts
      </Link>
      <Link
        to={`/projects/${id}/nfrs`}
        className={active("nfrs") ? "side-item active" : "side-item"}
      >
        NFRs
      </Link>
      <Link
        to={`/projects/${id}/opinions`}
        className={active("opinions") ? "side-item active" : "side-item"}
      >
        Opinions
      </Link>

      <div className="sidebar-section-label">Analysis</div>
      <Link
        to={`/projects/${id}/prioritization`}
        className={active("prioritization") ? "side-item active" : "side-item"}
      >
        Prioritization
      </Link>
      <Link
        to={`/projects/${id}/traceability`}
        className={active("traceability") ? "side-item active" : "side-item"}
      >
        Traceability
      </Link>
      <Link
        to={`/projects/${id}/tasks`}
        className={active("tasks") ? "side-item active" : "side-item"}
      >
        Tasks
      </Link>
      <Link
        to={`/projects/${id}/calendar`}
        className={active("calendar") ? "side-item active" : "side-item"}
      >
        Calendar
      </Link>

      <div className="sidebar-section-label">Collaboration</div>
      <Link
        to={`/projects/${id}/discussions`}
        className={active("discussions") ? "side-item active" : "side-item"}
      >
        Discussions
      </Link>
      <Link
        to={`/projects/${id}/collaborators`}
        className={active("collaborators") ? "side-item active" : "side-item"}
      >
        Collaborators
      </Link>

      {isOwner && (
        <>
          <div className="sidebar-section-label">Admin</div>
          <Link
            to={`/projects/${id}/settings`}
            className={active("settings") ? "side-item active" : "side-item"}
          >
            Settings
          </Link>
        </>
      )}
    </aside>
  );
}