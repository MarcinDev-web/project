/**
 * Support Page
 */

import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';

export function SupportPage() {
  return (
    <Layout>
      <div className="page-container">
        <h1>Support</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
          <Card>
            <h2>Need Help?</h2>
            <p>We're here to help! If you have any questions or need assistance, please reach out to us.</p>
          </Card>
          
          <Card>
            <h3>Contact Us</h3>
            <p>Email: support@forge.world</p>
            <p>We typically respond within 24 hours.</p>
          </Card>
          
          <Card>
            <h3>FAQ</h3>
            <p>Check out our frequently asked questions for quick answers to common questions.</p>
          </Card>
          
          <Card>
            <h3>Report a Bug</h3>
            <p>Found a bug? Please report it so we can fix it as soon as possible.</p>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

