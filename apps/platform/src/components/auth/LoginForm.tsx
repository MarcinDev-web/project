/**
 * Login form component with auto-save credentials
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/Card';

const SAVED_EMAIL_KEY = 'forge_login_email';
const SAVED_PASSWORD_KEY = 'forge_login_password';
const REMEMBER_ME_KEY = 'forge_remember_me';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

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
    <Card>
      <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-6)' }}>Login</h2>
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
        <div style={{ marginBottom: 'var(--spacing-6)', display: 'flex', alignItems: 'center' }}>
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{
              marginRight: 'var(--spacing-2)',
              cursor: 'pointer',
            }}
          />
          <label htmlFor="rememberMe" style={{ cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
            Zapamiętaj mnie
          </label>
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
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>
      </form>
    </Card>
  );
}

