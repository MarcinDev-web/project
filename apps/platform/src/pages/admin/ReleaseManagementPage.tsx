/**
 * Release Management Page (Admin)
 */

import { Layout } from '../../components/layout/Layout';
import { ReleaseAdmin } from '../../components/admin/ReleaseAdmin';

export function ReleaseManagementPage() {
  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Release Management</h1>
          <p style={{ color: 'var(--text-secondary, #666)' }}>
            Zarządzaj release'ami platformy z automatycznym semantic versioning i changelog generation.
          </p>
        </div>
        <ReleaseAdmin />
      </div>
    </Layout>
  );
}

