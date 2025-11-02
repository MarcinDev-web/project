import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';
import { adminApi, type MarketplaceItem } from '../../api/admin';

export function MarketplaceModerationPage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadItems();
  }, [page]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getMarketplaceItems({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      try {
        await adminApi.deleteMarketplaceItem(id);
        await loadItems();
      } catch (error) {
        console.error('Failed to delete item:', error);
        alert('Failed to delete item');
      }
    }
  };

  if (loading && items.length === 0) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Marketplace Management</h1>
        <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '1.5rem' }}>
          Total items: {total}
        </p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {items.map((item) => (
            <Card key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', margin: 0 }}>{item.title}</h3>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: item.type === 'build' ? 'var(--bg-primary, #e3f2fd)' : 'var(--bg-secondary, #f3e5f5)',
                      fontSize: '0.75rem',
                    }}>
                      {item.type}
                    </span>
                    {item.public ? (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-success, #e8f5e9)',
                        color: 'var(--color-success, #2e7d32)',
                        fontSize: '0.75rem',
                      }}>
                        Public
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-warning, #fff3e0)',
                        fontSize: '0.75rem',
                      }}>
                        Not Public
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '0.5rem' }}>
                      {item.description}
                    </p>
                  )}
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                    Author: {item.authorName || item.authorId} | 
                    Created: {new Date(item.createdAt).toLocaleDateString()} |
                    Likes: {item.likes} | Downloads: {item.downloads}
                  </div>
                </div>
                <div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleDelete(item.id)}
                    style={{ background: 'var(--bg-error, #ffebee)', color: 'var(--color-error, #c62828)' }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

