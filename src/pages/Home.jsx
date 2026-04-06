import React from "react";
import { Link } from "react-router-dom";
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <div className="home-hero">
        <div className="home-badge">AI-Powered Requirements</div>
        <h1 className="home-title">
          Check<span className="home-title-accent">list.</span>
        </h1>
        <p className="home-subtitle">
          Turn stakeholder ideas into structured, prioritized requirements — automatically.
        </p>
        <div className="home-actions">
          <Link to="/auth?mode=signup" className="home-btn-primary">Get Started</Link>
          <Link to="/auth?mode=login" className="home-btn-ghost">Login</Link>
        </div>
      </div>

      <div className="home-features">
        <div className="feature-card">
          <div className="feature-icon">✦</div>
          <div className="feature-text">
            <h3>AI-Generated Requirements</h3>
            <p>From rough ideas to structured, actionable specs in seconds.</p>
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">◈</div>
          <div className="feature-text">
            <h3>Smart Prioritization</h3>
            <p>AI surfaces what matters most to your stakeholders.</p>
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⬡</div>
          <div className="feature-text">
            <h3>Track Progress</h3>
            <p>Monitor status and evolution across your entire project.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
