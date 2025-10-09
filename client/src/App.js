import React from 'react';
import SubmitRequirement from './components/SubmitRequirement';
import RequirementList from './components/RequirementList';
import Visualization from './components/Visualization';

function App() {
  return (
    <div>
      <h1>Smart City Requirements Portal</h1>
      <SubmitRequirement />
      <RequirementList />
      <Visualization />
    </div>
  );
}

export default App;
