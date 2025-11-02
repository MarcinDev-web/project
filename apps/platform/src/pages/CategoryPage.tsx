import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ForumThreadList } from '../components/community/ForumThreadList';
import { Button } from '../components/shared/Button';
import { Card } from '../components/shared/Card';
import { forumApi, type ForumCategory, type ForumThread } from '../api/forum';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket, type WebSocketMessage } from '../hooks/useWebSocket';

export function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const sortBy = (searchParams.get('sort') as 'hot' | 'new' | 'top') || 'hot';

  useEffect(() => {
    if (id) {
      void loadCategory();
    }
  }, [id, sortBy]);

  // Handle WebSocket updates
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    if (message.type === 'forum:thread:new' && message.categoryId === id) {
      // New thread in this category - reload
      void loadCategory();
    } else if (message.type === 'forum:thread:updated') {
      // Update thread in list if it exists
      setThreads(prev => prev.map(t => 
        t.id === message.thread.id ? { ...t, ...message.thread } : t
      ));
    } else if (message.type === 'forum:thread:deleted' && message.categoryId === id) {
      // Remove deleted thread
      setThreads(prev => prev.filter(t => t.id !== message.threadId));
    } else if (message.type === 'forum:vote:changed' && message.threadId) {
      // Update thread vote score
      setThreads(prev => prev.map(t => 
        t.id === message.threadId ? { 
          ...t, 
          score: message.score, 
          upvotes: message.upvotes, 
          downvotes: message.downvotes 
        } : t
      ));
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  const loadCategory = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await forumApi.getCategory(id, sortBy);
      setCategory(data.category);
      setThreads(data.threads);
    } catch (error) {
      console.error('Failed to load category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSort: 'hot' | 'new' | 'top') => {
    setSearchParams({ sort: newSort });
  };

  if (!category) {
    return (
      <Layout>
        <div className="page-container">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
              Loading...
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
              Category not found
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <Link
            to="/community"
            style={{
              color: 'var(--text-2)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
              marginBottom: 'var(--spacing-2)',
              display: 'inline-block',
            }}
          >
            ← Back to Community
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-4)' }}>
            <div>
              {category.icon && (
                <span style={{ fontSize: '2em', marginRight: 'var(--spacing-2)', color: category.color }}>
                  {category.icon}
                </span>
              )}
              <h1 style={{ display: 'inline', margin: 0 }}>{category.name}</h1>
              <p style={{ marginTop: 'var(--spacing-2)', color: 'var(--text-2)' }}>
                {category.description}
              </p>
            </div>
            {user && (
              <Link to={`/community/new-thread?category=${id}`}>
                <Button>New Thread</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Sort buttons */}
        <Card>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            <button
              onClick={() => handleSortChange('hot')}
              style={{
                padding: 'var(--spacing-2) var(--spacing-4)',
                background: sortBy === 'hot' ? 'var(--bg-button-primary)' : 'var(--bg-button)',
                color: sortBy === 'hot' ? 'white' : 'var(--text-1)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: sortBy === 'hot' ? 'var(--font-semibold)' : 'var(--font-medium)',
              }}
            >
              Hot
            </button>
            <button
              onClick={() => handleSortChange('new')}
              style={{
                padding: 'var(--spacing-2) var(--spacing-4)',
                background: sortBy === 'new' ? 'var(--bg-button-primary)' : 'var(--bg-button)',
                color: sortBy === 'new' ? 'white' : 'var(--text-1)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: sortBy === 'new' ? 'var(--font-semibold)' : 'var(--font-medium)',
              }}
            >
              New
            </button>
            <button
              onClick={() => handleSortChange('top')}
              style={{
                padding: 'var(--spacing-2) var(--spacing-4)',
                background: sortBy === 'top' ? 'var(--bg-button-primary)' : 'var(--bg-button)',
                color: sortBy === 'top' ? 'white' : 'var(--text-1)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: sortBy === 'top' ? 'var(--font-semibold)' : 'var(--font-medium)',
              }}
            >
              Top
            </button>
          </div>
        </Card>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            Loading threads...
          </div>
        ) : (
          <ForumThreadList threads={threads} />
        )}
      </div>
    </Layout>
  );
}
