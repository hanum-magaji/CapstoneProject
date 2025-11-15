import React from 'react';
import './Header.css';

function Header({ onLogout }) {
  return (
    <header className="app-header">
      <div className="header-content">
        <h1 className="header-title">Smart City Requirements Portal</h1>
        <button onClick={onLogout} className="logout-button">Logout</button>
      </div>
    </header>
  );
}

export default Header;