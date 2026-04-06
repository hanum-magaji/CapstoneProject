import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import CreateProject from "./pages/CreateProject";
import ProjectCollaborators from "./pages/ProjectCollaborators";
import ProjectDiscussions from "./pages/Discussions";
import ProjectThreadView from "./pages/ThreadView";
import ProjectCalendar from "./pages/ProjectCalendar";
import ProjectTasks from "./pages/ProjectTasks";
import Inbox from "./pages/Inbox";
import Settings from "./pages/Settings";
import ProjectSettings from "./pages/ProjectSettings";
import ProjectRequirements from "./pages/ProjectRequirements";
import StakeholderSubmit from "./pages/StakeholderSubmit";
import Submissions from "./pages/Submissions";
import Clusters from "./pages/Clusters";
import Conflicts from "./pages/Conflicts";
import Nfrs from "./pages/Nfrs";
import Opinions from "./pages/Opinions";
import Prioritization from "./pages/Prioritization";
import Traceability from "./pages/Traceability";
import DashboardNew from "./pages/DashboardNew";
import Visualization from "./pages/Visualization";

import PreLoginNavbar from "./components/PreLoginNavbar";
import AuthNavbar from "./components/AuthNavbar";
import ProjectSidebar from "./components/ProjectSidebar";

import "./index.css";

/* -----------------------------------------
   Protected Route
----------------------------------------- */
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!session) return <Navigate to="/auth" />;
  return children;
}

/* -----------------------------------------
   Wrapper for ALL project pages (sidebar + content)
----------------------------------------- */
function ProjectLayout() {
  const { id } = useParams();

  return (
    <div style={{ display: "flex" }}>
      <ProjectSidebar projectId={id} />
      <div style={{ marginLeft: "220px", width: "100%" }}>
        <Routes>
          {/* Default project page (new dashboard) */}
          <Route index element={<DashboardNew />} />
          <Route path="overview-old" element={<ProjectDetail />} />

          {/* Other project subpages */}
          <Route path="collaborators" element={<ProjectCollaborators />} />
          <Route path="requirements" element={<Submissions />} />
          <Route path="spec" element={<ProjectRequirements />} />
          <Route path="submissions" element={<Navigate to="requirements" replace />} />
          <Route path="settings" element={<ProjectSettings />} />
          <Route path="calendar" element={<ProjectCalendar />} />
          <Route path="tasks" element={<ProjectTasks />} />
          <Route path="visualization" element={<Visualization />} />
          <Route path="clusters" element={<Clusters />} />
          <Route path="conflicts" element={<Conflicts />} />
          <Route path="nfrs" element={<Nfrs />} />
          <Route path="opinions" element={<Opinions />} />
          <Route path="prioritization" element={<Prioritization />} />
          <Route path="traceability" element={<Traceability />} />
          <Route path="discussions" element={<ProjectDiscussions />} />
          <Route path="discussions/:threadId" element={<ProjectThreadView />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="." />} />
        </Routes>
      </div>
    </div>
  );
}

/* -----------------------------------------
   App Content
----------------------------------------- */
function AppContent() {
  const location = useLocation();

  const publicRoutes = ["/", "/pricing", "/auth"];
  const isPublic = publicRoutes.includes(location.pathname);
  const isSubmitPage = location.pathname.startsWith("/submit/");

  return (
    <>
      {/* NAVBAR -- hidden on the public submission page */}
      {!isSubmitPage && (isPublic ? <PreLoginNavbar /> : <AuthNavbar />)}

      <Routes>
        {/* Public stakeholder submission (no auth, no navbar) */}
        <Route path="/submit/:projectId/:token" element={<StakeholderSubmit />} />

        {/* Public pages */}
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Inbox */}
        <Route
          path="/inbox"
          element={
            <ProtectedRoute>
              <Inbox />
            </ProtectedRoute>
          }
        />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Project list */}
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          }
        />

        {/* Create Project */}
        <Route
          path="/projects/new"
          element={
            <ProtectedRoute>
              <CreateProject />
            </ProtectedRoute>
          }
        />

        {/* ALL project content uses ProjectLayout */}
        <Route
          path="/projects/:id/*"
          element={
            <ProtectedRoute>
              <ProjectLayout />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

/* -----------------------------------------
   App Root
----------------------------------------- */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
