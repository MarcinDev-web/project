import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/shared/Card';
import { adminApi, type AdminStats } from '../../api/admin';

export function StatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [economy, setEconomy] = useState<{ totalWallets: number; totalTransactions: number; totalsByCurrency: Record<string, number> } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [core, econ] = await Promise.all([
        adminApi.getStats(),
        adminApi.getEconomyMetrics(),
      ]);
      setStats(core);
      setEconomy(econ);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Failed to load statistics</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>System Statistics</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Economy Metrics */}
          {economy && (
            <Card>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Economy</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Wallets:</span>
                  <strong>{economy.totalWallets}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Transactions:</span>
                  <strong>{economy.totalTransactions}</strong>
                </div>
                <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid var(--border-default)' }} />
                {Object.entries(economy.totalsByCurrency).map(([cur, amt]) => (
                  <div key={cur} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{cur} in circulation:</span>
                    <strong>{amt}</strong>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {/* Users Stats */}
          <Card>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Users</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Users:</span>
                <strong>{stats.users.total}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Active:</span>
                <strong>{stats.users.active}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Inactive:</span>
                <strong>{stats.users.inactive}</strong>
              </div>
              <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid var(--border-default)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Admins:</span>
                <strong>{stats.users.byRole.admin}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Moderators:</span>
                <strong>{stats.users.byRole.moderator}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Users:</span>
                <strong>{stats.users.byRole.user}</strong>
              </div>
            </div>
          </Card>

          {/* Marketplace Stats */}
          <Card>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Marketplace</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Items:</span>
                <strong>{stats.marketplace.total}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Builds:</span>
                <strong>{stats.marketplace.builds}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Avatars:</span>
                <strong>{stats.marketplace.avatars}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Public:</span>
                <strong>{stats.marketplace.public}</strong>
              </div>
              <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid var(--border-default)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Likes:</span>
                <strong>{stats.marketplace.totalLikes}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Downloads:</span>
                <strong>{stats.marketplace.totalDownloads}</strong>
              </div>
            </div>
          </Card>

          {/* Activity Stats */}
          <Card>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Activity</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Online Users:</span>
                <strong>{stats.activity.onlineUsers}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Shared Projects:</span>
                <strong>{stats.projects.total}</strong>
              </div>
            </div>
          </Card>
        </div>

        {/* Forum Statistics */}
        {stats.forum && (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Forum Statistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              <Card>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Categories</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Categories:</span>
                    <strong>{stats.forum.categories.total}</strong>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Threads</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Threads:</span>
                    <strong>{stats.forum.threads.total}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last 24h:</span>
                    <strong>{stats.forum.threads.last24h}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last 7 days:</span>
                    <strong>{stats.forum.threads.last7d}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last 30 days:</span>
                    <strong>{stats.forum.threads.last30d}</strong>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Posts</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Posts:</span>
                    <strong>{stats.forum.posts.total}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last 24h:</span>
                    <strong>{stats.forum.posts.last24h}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last 7 days:</span>
                    <strong>{stats.forum.posts.last7d}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last 30 days:</span>
                    <strong>{stats.forum.posts.last30d}</strong>
                  </div>
                </div>
              </Card>

              {stats.forum.topCategories.length > 0 && (
                <Card>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Top Categories</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {stats.forum.topCategories.map((cat) => (
                      <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{cat.name}:</span>
                        <strong>{cat.threadCount} threads, {cat.postCount} posts</strong>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

