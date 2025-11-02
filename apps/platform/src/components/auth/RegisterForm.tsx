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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password);
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

