/**
 * Shop Statistics Card Component
 */

import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { adminApi } from '../../api/admin';

export interface ShopStats {
  shopItems: {
    total: number;
    available: number;
    outOfStock: number;
  };
  assets: {
    total: number;
    available: number;
  };
  purchases: {
    total: number;
    last30Days: number;
  };
  revenue: Array<{
    currency: string;
    amount: number;
  }>;
}

export function ShopStatsCard() {
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getShopStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load shop stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card style={{ marginBottom: '2rem' }}>
        <div>Loading statistics...</div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Shop Statistics</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
            Shop Items
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.shopItems.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
            {stats.shopItems.available} available, {stats.shopItems.outOfStock} out of stock
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
            Assets
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.assets.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
            {stats.assets.available} available
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
            Purchases
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.purchases.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
            {stats.purchases.last30Days} in last 30 days
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '0.25rem' }}>
            Revenue
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {stats.revenue.length === 0 ? (
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>0</div>
            ) : (
              stats.revenue.map((rev) => (
                <div key={rev.currency} style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                  {rev.amount.toFixed(2)} {rev.currency}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

