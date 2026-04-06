// src/pages/Pricing.jsx
import "./Pricing.css";

export default function Pricing() {
  return (
    <div className="pricing-container">
      <div className="pricing-inner fade-in">
        <h1 className="pricing-title">Pricing Plans</h1>
        <p className="pricing-subtitle">
          Choose a plan that works best for your team. No hidden fees, cancel anytime.
        </p>

        <div className="pricing-grid fade-up">
          {/* Free Plan */}
          <div className="pricing-card light-card">
            <h2 className="plan-title">Free</h2>
            <p className="plan-price">$0 / month</p>
            <ul className="plan-features">
              <li>Up to 3 projects</li>
              <li>AI-generated requirements</li>
              <li>Basic support</li>
            </ul>
            <button className="plan-button primary-button">Get Started</button>
          </div>

          {/* Pro Plan */}
          <div className="pricing-card pro-card">
            <h2 className="plan-title light-text">Pro</h2>
            <p className="plan-price light-text">$29 / month</p>
            <ul className="plan-features light-text">
              <li>Unlimited projects</li>
              <li>Advanced AI prioritization</li>
              <li>Priority support</li>
            </ul>
            <button className="plan-button white-button">Get Started</button>
          </div>

          {/* Enterprise Plan */}
          <div className="pricing-card light-card">
            <h2 className="plan-title">Enterprise</h2>
            <p className="plan-price">Custom Pricing</p>
            <ul className="plan-features">
              <li>Team collaboration</li>
              <li>Dedicated AI support</li>
              <li>Custom integrations</li>
            </ul>
            <button className="plan-button primary-button">Contact Sales</button>
          </div>
        </div>
      </div>
    </div>
  );
}
