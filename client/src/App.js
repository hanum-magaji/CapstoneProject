import React, { useState } from 'react';
import Login from './components/Login';
import SignUp from './components/SignUp';
// Import our new Dashboard
import Dashboard from './components/Dashboard';

// We get rid of the other component imports, 
// as Dashboard will handle them.

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authPage, setAuthPage] = useState('login');

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  // --- NEW LOGOUT FUNCTION ---
  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthPage('login'); // Reset to login page
  };
  // --- END OF NEW FUNCTION ---

  const showLogin = () => {
    setAuthPage('login');
  };

  const showSignUp = () => {
    setAuthPage('signup');
  };

  const renderAuth = () => {
    if (authPage === 'login') {
      return <Login onLoginSuccess={handleLoginSuccess} onShowSignUp={showSignUp} />;
    } else {
      return <SignUp onShowLogin={showLogin} />;
    }
  };

  return (
    <div className="App"> {/* Added a root class */}
      {!isLoggedIn ? (
        // If NOT logged in, show login/signup
        renderAuth()
      ) : (
        // If logged in, show the Dashboard and pass the logout function
        <Dashboard onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;