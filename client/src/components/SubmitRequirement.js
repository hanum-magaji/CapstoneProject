import React, { useState } from 'react';
import './SubmitRequirement.css';

// This 'onSubmit' function will come from the Dashboard component
function SubmitRequirement({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('e-permitting'); // Default category

  const handleSubmit = (event) => {
    event.preventDefault(); // Stop page reload

    if (!title || !description) {
      alert('Please fill in both title and description.');
      return;
    }

    // Call the function from Dashboard.js with the new requirement data
    onSubmit({ title, description, category });

    // Clear the form fields after submit
    setTitle('');
    setDescription('');
    setCategory('e-permitting');
  };

  return (
    <div className="submit-container">
      <form className="submit-form" onSubmit={handleSubmit}>
        <h3>Submit a New Requirement</h3>
        <p>Share your needs, ideas, or concerns for smart city services.</p>
        
        <div className="input-group">
          <label htmlFor="req-title">Requirement Title</label>
          <input
            type="text"
            id="req-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 'Faster permit approval status'"
            required
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="req-desc">Description (Natural Language)</label>
          <textarea
            id="req-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="6"
            placeholder="Describe the requirement in detail. What problem does it solve? Who is it for?"
            required
          ></textarea>
        </div>

        <div className="input-group">
          <label htmlFor="req-category">Service Category</label>
          <select 
            id="req-category" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="e-permitting">E-Permitting</option>
            <option value="public-transit">Public Transit Tracking</option>
            <option value="civic-engagement">Civic Engagement</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button type="submit" className="submit-button">Submit Requirement</button>
      </form>
    </div>
  );
}

export default SubmitRequirement;