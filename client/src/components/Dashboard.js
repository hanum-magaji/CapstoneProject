import React, { useState } from 'react';
import './Dashboard.css';
import Header from './Header';
import SubmitRequirement from './SubmitRequirement';
import RequirementList from './RequirementList';
// We still import Visualization, but will lay it out later
import Visualization from './Visualization';

function Dashboard({ onLogout }) {
  // This state will hold all the requirements submitted
  const [requirements, setRequirements] = useState([]);

  // This function will be passed to SubmitRequirement
  const handleRequirementSubmit = (newRequirement) => {
    // Add a unique ID and default status to the new requirement
    const requirementToAdd = {
      ...newRequirement,
      id: Date.now(), // Simple unique ID for now
      status: 'Submitted',
    };
    // Add the new requirement to the list
    setRequirements([requirementToAdd, ...requirements]);
  };

  return (
    <div className="dashboard-container">
      <Header onLogout={onLogout} />
      <main className="dashboard-main">
        <div className="dashboard-left">
          {/* Pass the submit handler to the form component */}
          <SubmitRequirement onSubmit={handleRequirementSubmit} />
        </div>
        <div className="dashboard-right">
          {/* Pass the list of requirements to the list component */}
          <RequirementList requirements={requirements} />
        </div>
        {/* We can add the visualization component here later */}
        {/* <div className="dashboard-full-width">
          <Visualization />
        </div> 
        */}
      </main>
    </div>
  );
}

export default Dashboard;