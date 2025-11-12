/**
 * News Management Page (Admin)
 */

import { Layout } from '../../components/layout/Layout';
import { NewsAdmin } from '../../components/admin/NewsAdmin';

export function NewsManagementPage() {
  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>News Management</h1>
          <p style={{ color: 'var(--text-secondary, #666)' }}>
            Create and manage news articles for the platform.
          </p>
        </div>
        <NewsAdmin />
      </div>
    </Layout>
  );
}

