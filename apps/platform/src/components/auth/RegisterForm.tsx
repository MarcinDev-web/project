/**
 * Registration form component
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/Card';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate username
    if (!username || username.length < 3 || username.length > 20) {
      setError('Username must be between 3 and 20 characters long');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
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
    <Card>
      <h2 className="auth-form-title">Create Account</h2>
      <form onSubmit={handleSubmit}>
        <div className="auth-form-group">
          <label htmlFor="email" className="auth-form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-form-input"
          />
        </div>
        <div className="auth-form-group">
          <label htmlFor="username" className="auth-form-label">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            title="Username can only contain letters, numbers, and underscores"
            className="auth-form-input"
          />
          <small className="auth-form-hint">
            3-20 characters, letters, numbers, and underscores only
          </small>
        </div>
        <div className="auth-form-group">
          <label htmlFor="password" className="auth-form-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="auth-form-input"
          />
        </div>
        <div className="auth-form-group">
          <label htmlFor="confirmPassword" className="auth-form-label">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="auth-form-input"
          />
        </div>
        {error && (
          <div className="auth-form-error">
            {error}
          </div>
        )}
        <Button type="submit" disabled={isLoading} className="auth-form-submit">
          {isLoading ? 'Creating account...' : 'Register'}
        </Button>
      </form>
    </Card>
  );
}

