import { Link } from "react-router-dom";
import "./PreLoginNavbar.css";

export default function PreLoginNavbar() {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-left">
          <div className="nav-logo">Check<span>list</span></div>
          <div className="nav-links">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/pricing" className="nav-link">Pricing</Link>
          </div>
        </div>

        <div className="nav-right">
          <Link to="/auth?mode=login" className="nav-btn-outline">Login</Link>
          <Link to="/auth?mode=signup" className="nav-btn-solid">Get Started</Link>
        </div>
      </div>
    </nav>
  );
}
