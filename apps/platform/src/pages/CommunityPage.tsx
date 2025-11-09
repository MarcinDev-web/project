import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ForumLayout } from '../components/community/ForumLayout';
import { ForumSidebar } from '../components/community/ForumSidebar';
import { ForumThreadList } from '../components/community/ForumThreadList';
import { Button } from '../components/shared/Button';
import { Card } from '../components/shared/Card';
import { forumApi, type ForumCategory, type ForumThread } from '../api/forum';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

export function CommunityPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const sortBy = (searchParams.get('sort') as 'hot' | 'new' | 'top') || 'hot';

  useEffect(() => {
    void loadData();
  }, [sortBy]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesData, allThreads] = await Promise.all([
        forumApi.getCategories(),
        // Get threads from all categories - in a real app, you'd have a dedicated endpoint
        Promise.all(
          (await forumApi.getCategories()).map(cat => 
            forumApi.getCategory(cat.id, sortBy).then(data => data.threads)
          )
        ).then(results => results.flat().sort((a, b) => {
          if (sortBy === 'hot') return b.score - a.score;
          if (sortBy === 'new') return b.createdAt - a.createdAt;
          return b.score - a.score;
        }))
      ]);
      setCategories(categoriesData);
      setThreads(allThreads.slice(0, 20)); // Limit to 20 threads
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSort: 'hot' | 'new' | 'top') => {
    setSearchParams({ sort: newSort });
  };

  return (
    <Layout>
      <ForumLayout
        sidebar={<ForumSidebar categories={categories} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 'var(--forum-title-lg)' }}>Community Forum</h1>
            {user && (
              <Link to="/community/new-thread">
                <Button>New Thread</Button>
              </Link>
            )}
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

          {/* Thread list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
              Loading threads...
            </div>
          ) : (
            <ForumThreadList threads={threads} />
          )}
        </div>
      </ForumLayout>
    </Layout>
  );
}
