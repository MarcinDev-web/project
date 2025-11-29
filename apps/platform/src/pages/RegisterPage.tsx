/**
 * Register Page - Playverse Gateway Design
 * 
 * Split-screen immersive registration experience with:
 * - Animated visual branding side
 * - Glassmorphism form card
 * - Floating particles
 */

import { Navigate } from 'react-router-dom';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-page">
      {/* Visual Side - Branding & Animations */}
      <div className="auth-visual">
        {/* Floating Particles */}
        <div className="auth-particles">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="auth-particle" />
          ))}
        </div>

        {/* Branding Content */}
        <div className="auth-branding">
          <div className="auth-logo">
            <div className="auth-logo-icon">🎮</div>
            <span className="auth-logo-text">PLAYVERSE</span>
          </div>
          
          <p className="auth-tagline">Create • Play • Share</p>

          <div className="auth-features">
            <div className="auth-feature">
              <span className="auth-feature-icon">🛠️</span>
              <span>Powerful 3D creation tools</span>
            </div>
            <div className="auth-feature">
              <span className="auth-feature-icon">👥</span>
              <span>Join thousands of creators</span>
            </div>
            <div className="auth-feature">
              <span className="auth-feature-icon">💰</span>
              <span>Earn from your creations</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="auth-form-side">
        <RegisterForm />
      </div>
    </div>
  );
}
