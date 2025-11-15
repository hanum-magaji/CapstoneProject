import React, { useState } from 'react';
import './SignUp.css'; // We will create this file next

function SignUp({ onShowLogin }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(''); // Clear previous errors

    // --- Placeholder Sign-Up Logic ---
    // Check if passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return; // Stop the submission
    }

    // Check if fields are filled (basic check)
    if (!fullName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    // If all checks pass, we pretend to create an account.
    // In a real app, we would send this to our server.
    console.log('Account creation request for:', fullName, email);

    // For now, just log it and send the user to the login page
    alert('Sign-up successful! Please log in.');
    onShowLogin(); // This function comes from App.js to switch the view
    // --- End of Placeholder Logic ---
  };

  return (
    <div className="signup-container">
      <form className="signup-form" onSubmit={handleSubmit}>
        <h2>Create Account</h2>
        <p className="form-description">Join the Smart City Requirements Portal</p>
        
        <div className="input-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        
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

        <div className="input-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="signup-button">Create Account</button>
        
        <p className="login-link">
          Already have an account?{' '}
          <span onClick={onShowLogin}>
            Log In
          </span>
        </p>
      </form>
    </div>
  );
}

export default SignUp;