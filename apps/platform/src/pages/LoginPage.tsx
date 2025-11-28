/**
 * Login Page - Forge Gateway Design
 * 
 * Split-screen immersive login experience with:
 * - Animated visual branding side
 * - Glassmorphism form card
 * - Floating ember particles
 */

import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
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
            <div className="auth-logo-icon">⚡</div>
            <span className="auth-logo-text">FORGE</span>
          </div>
          
          <p className="auth-tagline">Build • Play • Create</p>

          <div className="auth-features">
            <div className="auth-feature">
              <span className="auth-feature-icon">🎮</span>
              <span>Create immersive 3D worlds</span>
            </div>
            <div className="auth-feature">
              <span className="auth-feature-icon">🌍</span>
              <span>Share with a global community</span>
            </div>
            <div className="auth-feature">
              <span className="auth-feature-icon">🚀</span>
              <span>Publish and monetize your games</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="auth-form-side">
        <LoginForm />
      </div>
    </div>
  );
}
