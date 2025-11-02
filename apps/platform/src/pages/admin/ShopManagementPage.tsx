/**
 * Shop Management Page - Admin Panel
 */

import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { ShopItemsAdmin } from '../../components/admin/ShopItemsAdmin';
import { AssetsAdmin } from '../../components/admin/AssetsAdmin';
import { MarketplacePricesAdmin } from '../../components/admin/MarketplacePricesAdmin';
import { ShopStatsCard } from '../../components/admin/ShopStatsCard';

type TabType = 'items' | 'assets' | 'prices';

export function ShopManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('items');

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Shop Management</h1>
          <p style={{ color: 'var(--text-secondary, #666)' }}>
            Manage shop items, assets, and marketplace prices
          </p>
        </div>

        {/* Stats Card */}
        <ShopStatsCard />

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '2px solid var(--border-default)',
            marginBottom: '2rem',
          }}
        >
          <button
            onClick={() => setActiveTab('items')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'items' ? 'var(--bg-button-primary)' : 'transparent',
              color: activeTab === 'items' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              fontWeight: activeTab === 'items' ? 'var(--font-semibold)' : 'var(--font-medium)',
              borderBottom: activeTab === 'items' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            Shop Items
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'assets' ? 'var(--bg-button-primary)' : 'transparent',
              color: activeTab === 'assets' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              fontWeight: activeTab === 'assets' ? 'var(--font-semibold)' : 'var(--font-medium)',
              borderBottom: activeTab === 'assets' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            Assets
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'prices' ? 'var(--bg-button-primary)' : 'transparent',
              color: activeTab === 'prices' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              fontWeight: activeTab === 'prices' ? 'var(--font-semibold)' : 'var(--font-medium)',
              borderBottom: activeTab === 'prices' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            Marketplace Prices
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'items' && <ShopItemsAdmin />}
        {activeTab === 'assets' && <AssetsAdmin />}
        {activeTab === 'prices' && <MarketplacePricesAdmin />}
      </div>
    </Layout>
  );
}

