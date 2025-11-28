/**
 * Login Form Component - Forge Gateway Design
 * 
 * Features:
 * - Password visibility toggle
 * - Remember me with auto-save credentials
 * - Social login buttons (placeholder)
 * - Smooth animations and micro-interactions
 * - Link to registration page
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const SAVED_EMAIL_KEY = 'forge_login_email';
const SAVED_PASSWORD_KEY = 'forge_login_password';
const REMEMBER_ME_KEY = 'forge_remember_me';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Load saved credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY);
    const savedRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true';

    if (savedRememberMe && savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      
      // Save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem(SAVED_EMAIL_KEY, email);
        localStorage.setItem(SAVED_PASSWORD_KEY, password);
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        // Clear saved credentials if not remembering
        localStorage.removeItem(SAVED_EMAIL_KEY);
        localStorage.removeItem(SAVED_PASSWORD_KEY);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
      
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      {/* Mobile Branding - Only visible on small screens */}
      <div className="auth-mobile-branding">
        <div className="auth-mobile-logo">
          <div className="auth-mobile-logo-icon">⚡</div>
          <span className="auth-mobile-logo-text">FORGE</span>
        </div>
      </div>

      {/* Card Header */}
      <div className="auth-card-header">
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to continue your journey</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="auth-form">
        {/* Email Input */}
        <div className="auth-input-group">
          <label htmlFor="email" className="auth-label">
            Email
          </label>
          <div className="auth-input-wrapper">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="auth-input"
              autoComplete="email"
            />
            <span className="auth-input-icon">📧</span>
          </div>
        </div>

        {/* Password Input */}
        <div className="auth-input-group">
          <label htmlFor="password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="auth-input"
              style={{ paddingRight: '48px' }}
              autoComplete="current-password"
            />
            <span className="auth-input-icon">🔒</span>
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="auth-checkbox-group">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="auth-checkbox"
          />
          <label htmlFor="rememberMe" className="auth-checkbox-label">
            Remember me
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="auth-error">
            <span className="auth-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={isLoading} 
          className={`auth-submit ${isLoading ? 'loading' : ''}`}
        >
          <span className="auth-submit-content">
            {isLoading ? (
              <>
                <span className="auth-spinner"></span>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Enter the Forge</span>
                <span>→</span>
              </>
            )}
          </span>
        </button>
      </form>

      {/* Divider */}
      <div className="auth-divider">
        <span className="auth-divider-text">or continue with</span>
      </div>

      {/* Social Login Buttons */}
      <div className="auth-social-buttons">
        <button type="button" className="auth-social-btn" disabled>
          <span className="auth-social-icon">🎮</span>
          <span>Discord</span>
        </button>
        <button type="button" className="auth-social-btn" disabled>
          <span className="auth-social-icon">🔗</span>
          <span>Google</span>
        </button>
      </div>

      {/* Footer Link */}
      <div className="auth-footer">
        <p className="auth-footer-text">
          Don't have an account?{' '}
          <Link to="/register" className="auth-footer-link">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
