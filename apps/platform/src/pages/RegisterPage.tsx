import { Navigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: '500px', marginTop: 'var(--spacing-12)' }}>
        <RegisterForm />
      </div>
    </Layout>
  );
}

