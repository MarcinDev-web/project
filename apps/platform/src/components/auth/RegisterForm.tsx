/**
 * Registration Form Component - Playverse Gateway Design
 * 
 * Features:
 * - Password visibility toggles
 * - Password strength indicator
 * - Real-time username validation
 * - Smooth animations and micro-interactions
 * - Link to login page
 */

import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Password strength calculation
function calculatePasswordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: '' };
  
  let score = 0;
  
  // Length checks
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  // Normalize to 0-4 scale
  const normalizedScore = Math.min(4, Math.floor(score / 2));
  
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return { 
    score: normalizedScore, 
    label: labels[normalizedScore] || '' 
  };
}

// Username validation
function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username) return { valid: false };
  if (username.length < 3) return { valid: false, error: 'Too short' };
  if (username.length > 20) return { valid: false, error: 'Too long' };
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Invalid characters' };
  }
  return { valid: true };
}

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Password strength
  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);
  
  // Username validation
  const usernameValidation = useMemo(() => validateUsername(username), [username]);
  
  // Password match
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate username
    if (!usernameValidation.valid) {
      if (usernameValidation.error) {
        setError(`Username: ${usernameValidation.error}`);
      } else {
        setError('Username must be between 3 and 20 characters long');
      }
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 2) {
      setError('Password is too weak. Use at least 8 characters with numbers and letters.');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      {/* Mobile Branding - Only visible on small screens */}
      <div className="auth-mobile-branding">
        <div className="auth-mobile-logo">
          <div className="auth-mobile-logo-icon">🎮</div>
          <span className="auth-mobile-logo-text">PLAYVERSE</span>
        </div>
      </div>

      {/* Card Header */}
      <div className="auth-card-header">
        <h2 className="auth-title">Join Playverse</h2>
        <p className="auth-subtitle">Create your account and start building</p>
      </div>

      {/* Registration Form */}
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

        {/* Username Input */}
        <div className="auth-input-group">
          <label htmlFor="username" className="auth-label">
            Username
          </label>
          <div className="auth-input-wrapper">
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              className={`auth-input ${username && (usernameValidation.valid ? 'valid' : 'invalid')}`}
              autoComplete="username"
            />
            <span className="auth-input-icon">👤</span>
            {username && (
              <span className={`auth-validation-icon ${usernameValidation.valid ? 'valid' : 'invalid'}`}>
                {usernameValidation.valid ? '✓' : '✕'}
              </span>
            )}
          </div>
          <span className="auth-hint">
            3-20 characters, letters, numbers, and underscores only
          </span>
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
              placeholder="Create a strong password"
              required
              minLength={6}
              className="auth-input"
              style={{ paddingRight: '48px' }}
              autoComplete="new-password"
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
          
          {/* Password Strength Indicator */}
          {password && (
            <>
              <div className="auth-password-strength">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`auth-strength-bar ${
                      passwordStrength.score >= level 
                        ? `active ${passwordStrength.score <= 1 ? 'weak' : passwordStrength.score <= 2 ? 'medium' : 'strong'}` 
                        : ''
                    }`}
                  />
                ))}
              </div>
              <span className={`auth-strength-text ${
                passwordStrength.score <= 1 ? 'weak' : passwordStrength.score <= 2 ? 'medium' : 'strong'
              }`}>
                {passwordStrength.label}
              </span>
            </>
          )}
        </div>

        {/* Confirm Password Input */}
        <div className="auth-input-group">
          <label htmlFor="confirmPassword" className="auth-label">
            Confirm Password
          </label>
          <div className="auth-input-wrapper">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              minLength={6}
              className={`auth-input ${confirmPassword && (passwordsMatch ? 'valid' : 'invalid')}`}
              style={{ paddingRight: '48px' }}
              autoComplete="new-password"
            />
            <span className="auth-input-icon">🔐</span>
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
            {confirmPassword && (
              <span 
                className={`auth-validation-icon ${passwordsMatch ? 'valid' : 'invalid'}`}
                style={{ right: '48px' }}
              >
                {passwordsMatch ? '✓' : '✕'}
              </span>
            )}
          </div>
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
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <span>→</span>
              </>
            )}
          </span>
        </button>
      </form>

      {/* Divider */}
      <div className="auth-divider">
        <span className="auth-divider-text">or sign up with</span>
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
          Already have an account?{' '}
          <Link to="/login" className="auth-footer-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
