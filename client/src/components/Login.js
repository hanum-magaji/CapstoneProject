import React, { useState } from 'react';
import './Login.css';

// Add the new 'onShowSignUp' prop
function Login({ onLoginSuccess, onShowSignUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault(); 
    if (email === 'hanum@example.com' && password === 'hanum123') {
      console.log('Login successful for:', email);
      setError('');
      onLoginSuccess();
    } else {
      setError('Invalid email or password. (Hint: try hanum@example.com / password123)');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Stakeholder Login</h2>
        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="login-button">Login</button>

        {/* --- ADD THIS NEW SECTION --- */}
        <p className="signup-link">
          Don't have an account?{' '}
          <span onClick={onShowSignUp}>
            Sign Up
          </span>
        </p>
        {/* --- END OF NEW SECTION --- */}
      </form>
    </div>
  );
}

export default Login;