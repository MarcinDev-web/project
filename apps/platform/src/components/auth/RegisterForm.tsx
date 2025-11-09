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
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-6)' }}>Create Account</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
            }}
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="username" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>
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
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
            }}
          />
          <small style={{ display: 'block', marginTop: 'var(--spacing-1)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            3-20 characters, letters, numbers, and underscores only
          </small>
        </div>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
            }}
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: 'var(--spacing-2)' }}>
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
            }}
          />
        </div>
        {error && (
          <div style={{ 
            marginBottom: 'var(--spacing-4)', 
            color: 'var(--color-error)',
            fontSize: 'var(--text-sm)',
          }}>
            {error}
          </div>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Register'}
        </Button>
      </form>
    </Card>
  );
}

