import React from 'react';
import './RequirementList.css'; // We'll create this

// Get the 'requirements' array from the Dashboard component
function RequirementList({ requirements }) {
  
  // If there are no requirements, show a friendly message
  if (requirements.length === 0) {
    return (
      <div className="req-list-container empty">
        <h3>Submitted Requirements</h3>
        <p>No requirements submitted yet. Add one using the form!</p>
      </div>
    );
  }

  // If there are requirements, map over them and display a card for each
  return (
    <div className="req-list-container">
      <h3>Submitted Requirements</h3>
      {requirements.map(req => (
        <div key={req.id} className="req-card">
          <div className="req-card-header">
            <h4>{req.title}</h4>
            <span className={`status status-${req.status.toLowerCase()}`}>
              {req.status}
            </span>
          </div>
          <p className="req-card-category">{req.category}</p>
          <p className="req-card-desc">{req.description}</p>
        </div>
      ))}
    </div>
  );
}

export default RequirementList;