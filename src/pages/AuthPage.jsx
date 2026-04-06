// src/pages/AuthPage.jsx

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./AuthPage.css";

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") || "login";

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const urlMode = searchParams.get("mode") || "login";
    if (urlMode !== mode) setMode(urlMode);
  }, [searchParams]);

  function switchMode(newMode) {
    setMode(newMode);
    setSearchParams({ mode: newMode });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { alert(error.message); setLoading(false); return; }
      navigate("/projects");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { alert(error.message); setLoading(false); return; }

    if (data?.user) {
      await supabase.from("users").insert([{
        id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        email,
      }]);
    }

    alert("Account created! Check your email for verification if required.");
    setLoading(false);
    navigate("/projects");
  }

  return (
    <div className="auth-container">
      <div className="auth-card">

        <div className="auth-logo">Check<span>list</span></div>

        <h1 className="auth-title">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Sign in to your workspace"
            : "Get started for free today"}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>

          {mode === "signup" && (
            <>
              <input
                className="auth-input"
                type="text"
                placeholder="First name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="auth-input"
                type="text"
                placeholder="Last name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </>
          )}

          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="auth-button" type="submit" disabled={loading}>
            {loading
              ? mode === "login" ? "Signing in…" : "Creating…"
              : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? (
            <>No account?{" "}<span onClick={() => switchMode("signup")}>Sign up</span></>
          ) : (
            <>Already a member?{" "}<span onClick={() => switchMode("login")}>Sign in</span></>
          )}
        </p>
      </div>
    </div>
  );
}
