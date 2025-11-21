import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ForumLayout } from '../components/community/ForumLayout';
import { ForumSidebar } from '../components/community/ForumSidebar';
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
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const sortBy = (searchParams.get('sort') as 'hot' | 'new' | 'top') || 'hot';

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (id) {
      void loadCategory();
    }
  }, [id, sortBy]);

  const loadCategories = async () => {
    try {
      const data = await forumApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

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

  if (!category && !loading) {
    return (
      <Layout>
        <div className="page-container">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            Category not found
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ForumLayout
        sidebar={<ForumSidebar categories={categories} activeCategoryId={id} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {/* Breadcrumbs */}
          <div>
            <Link
              to="/community-hub?tab=community"
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
          </div>

          {/* Category Header */}
          {category && (
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-4)' }}>
                <div>
                  {category.icon && (
                    <span style={{ fontSize: '2em', marginRight: 'var(--spacing-2)', color: category.color }}>
                      {category.icon}
                    </span>
                  )}
                  <h1 style={{ display: 'inline', margin: 0, fontSize: 'var(--forum-title-lg)' }}>{category.name}</h1>
                  <p style={{ marginTop: 'var(--spacing-2)', color: 'var(--text-2)' }}>
                    {category.description}
                  </p>
                  <div style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--forum-meta)', color: 'var(--text-3)' }}>
                    {category.threadCount} threads • {category.postCount} posts
                  </div>
                </div>
                {user && (
                  <Link to={`/community/new-thread?category=${id}`}>
                    <Button>New Thread</Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Sort buttons */}
          <div className="forum-sort-controls">
            <button
              onClick={() => handleSortChange('hot')}
              className={`forum-sort-button ${sortBy === 'hot' ? 'forum-sort-button--active' : ''}`}
              aria-pressed={sortBy === 'hot'}
            >
              <span>🔥</span>
              Hot
            </button>
            <button
              onClick={() => handleSortChange('new')}
              className={`forum-sort-button ${sortBy === 'new' ? 'forum-sort-button--active' : ''}`}
              aria-pressed={sortBy === 'new'}
            >
              <span>✨</span>
              New
            </button>
            <button
              onClick={() => handleSortChange('top')}
              className={`forum-sort-button ${sortBy === 'top' ? 'forum-sort-button--active' : ''}`}
              aria-pressed={sortBy === 'top'}
            >
              <span>📈</span>
              Top
            </button>
          </div>

          {/* Thread list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
              Loading threads...
            </div>
          ) : (
            <ForumThreadList threads={threads} onThreadUpdate={loadCategory} />
          )}
        </div>
      </ForumLayout>
    </Layout>
  );
}
