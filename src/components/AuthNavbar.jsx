import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./AuthNavbar.css";

export default function AuthNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => pathname.startsWith(path);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { alert("Error logging out: " + error.message); return; }
    navigate("/");
  };

  const navbarStyle = {
    width: "100%",
    height: "64px",
    position: "sticky",
    top: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    background: "rgba(8, 8, 16, 0.85)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
  };

  const innerStyle = {
    maxWidth: "1200px",
    width: "100%",
    margin: "0 auto",
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "100%",
    boxSizing: "border-box",
  };

  const leftStyle = {
    display: "flex",
    alignItems: "center",
    height: "100%",
    gap: "4px",
  };

  const rightStyle = {
    display: "flex",
    alignItems: "center",
    height: "100%",
    gap: "8px",
  };

  const logoStyle = {
    fontWeight: 800,
    fontSize: "1.1rem",
    color: "white",
    textDecoration: "none",
    letterSpacing: "-0.02em",
    marginRight: "16px",
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
  };

  const navLinkStyle = (active) => ({
    color: active ? "#818cf8" : "#8888aa",
    fontWeight: active ? 600 : 500,
    background: active ? "rgba(99,102,241,0.08)" : "transparent",
    textDecoration: "none",
    fontSize: "0.875rem",
    padding: "0.4rem 0.75rem",
    borderRadius: "7px",
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
    fontFamily: "'Inter', sans-serif",
    transition: "color 0.2s, background 0.2s",
  });

  return (
    <nav style={navbarStyle}>
      <div style={innerStyle}>
        <div style={leftStyle}>
          <Link to="/projects" style={logoStyle}>
            Check<span style={{ color: "#6366f1" }}>list</span>
          </Link>
          <Link to="/dashboard" style={navLinkStyle(isActive("/dashboard"))}>Dashboard</Link>
          <Link to="/projects" style={navLinkStyle(isActive("/projects"))}>Projects</Link>
          <Link to="/inbox" style={navLinkStyle(isActive("/inbox"))}>Inbox</Link>
        </div>

        <div style={rightStyle}>
          <Link to="/settings" style={navLinkStyle(isActive("/settings"))}>Settings</Link>
          <button
            onClick={handleLogout}
            style={{
              color: "#9090b8",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "0.4rem 0.85rem",
              borderRadius: "7px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: "transparent",
              display: "flex",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
