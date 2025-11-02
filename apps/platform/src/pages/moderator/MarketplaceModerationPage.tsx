import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';
import { moderatorApi, type MarketplaceItem } from '../../api/moderator';

export function MarketplaceModerationPage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await moderatorApi.getPendingItems();
      setItems(response.items);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await moderatorApi.approveItem(id);
      await loadItems();
    } catch (error) {
      console.error('Failed to approve item:', error);
      alert('Failed to approve item');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason (optional):');
    if (reason !== null) {
      try {
        await moderatorApi.rejectItem(id, reason || undefined);
        await loadItems();
      } catch (error) {
        console.error('Failed to reject item:', error);
        alert('Failed to reject item');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await moderatorApi.deleteItem(id);
        await loadItems();
      } catch (error) {
        console.error('Failed to delete item:', error);
        alert('Failed to delete item');
      }
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Marketplace Moderation</h1>
        <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '1.5rem' }}>
          {items.length} items pending moderation
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
                    {!item.public && (
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
                  {item.tags.length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-button)',
                            fontSize: '0.75rem',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {!item.public && (
                    <Button variant="primary" size="small" onClick={() => handleApprove(item.id)}>
                      Approve
                    </Button>
                  )}
                  <Button variant="secondary" size="small" onClick={() => handleReject(item.id)}>
                    Reject
                  </Button>
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

        {items.length === 0 && !loading && (
          <Card>
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #666)' }}>
              No items pending moderation
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}

