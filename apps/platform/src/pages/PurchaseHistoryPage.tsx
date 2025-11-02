/**
 * Purchase History Page
 */

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { shopApi, type Purchase } from '../api/shop';
import { useAuth } from '../contexts/AuthContext';

export function PurchaseHistoryPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      void loadPurchases();
    }
  }, [user]);

  const loadPurchases = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await shopApi.getPurchases({ limit: 50 });
      setPurchases(response.purchases);
    } catch (error) {
      console.error('Failed to load purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Purchase History</h1>
          <p>Please log in to view your purchase history.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem' }}>
        <h1>Purchase History</h1>

        {loading ? (
          <div>Loading...</div>
        ) : purchases.length === 0 ? (
          <Card>
            <p>No purchases yet.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
            {purchases.map((purchase) => (
              <Card key={purchase.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3>Purchase #{purchase.id.substring(0, 8)}</h3>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>
                      {new Date(purchase.createdAt).toLocaleString()}
                    </p>
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong>Items:</strong>
                      <ul style={{ marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
                        {purchase.items.map((item, index) => (
                          <li key={index}>
                            {item.name} - {item.price.amount} {item.price.currency}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-md)',
                        background:
                          purchase.status === 'completed'
                            ? 'var(--color-success)'
                            : purchase.status === 'failed'
                              ? 'var(--color-error)'
                              : 'var(--bg-button)',
                        color: 'white',
                        fontSize: '0.875rem',
                      }}
                    >
                      {purchase.status}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.125rem', fontWeight: 'bold' }}>
                      Total: {purchase.totalCost.amount} {purchase.totalCost.currency}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

