import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Projects from './pages/Projects';
import ProjectLayout from './components/ProjectLayout';
import Overview as ProjectOverview from './pages/ProjectOverview';
import Submissions from './pages/Submissions';
import Clusters from './pages/Clusters';
import Tasks from './pages/Tasks';
import Collaborators from './pages/Collaborators';
import Settings from './pages/Settings';
import Discussions from './pages/Discussions';
import Calendar from './pages/Calendar';
import StakeholderSubmit from './pages/StakeholderSubmit';
//=== Phase 4 MoSCoW engine placeholder ===//
const Prioritization = React.lazy(() => import('./pages/Tasks'));
const Conflicts = React.lazy(() => import('./pages/Conflicts'));

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public stakeholder submission form — no login required */}
          <Route path="/submit/:projectId/:token" element={<StakeholderSubmit />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="projects" element={<Projects />} />
            <Route path="settings" element={<Settings />} />
            <Route path="projects/:id/*" element={<ProjectLayout />}>
              <Route index element={<ProjectOverview />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="clusters" element={<Clusters />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="conflicts" element={<Conflicts />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="discussions" element={<Discussions />} />
              <Route path="collaborators" element={<Collaborators />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;