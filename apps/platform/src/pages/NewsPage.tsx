/**
 * News Page
 */

import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';

export function NewsPage() {
  return (
    <Layout>
      <div className="page-container">
        <h1>News</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
          <Card>
            <h2>Latest Updates</h2>
            <p>Stay up to date with the latest news and updates from Forge World.</p>
          </Card>
          
          <Card>
            <h3>Coming Soon</h3>
            <p>News feed will be available here soon.</p>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

