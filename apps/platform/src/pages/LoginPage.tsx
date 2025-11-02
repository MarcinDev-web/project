import { Navigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: '500px', marginTop: 'var(--spacing-12)' }}>
        <LoginForm />
      </div>
    </Layout>
  );
}

