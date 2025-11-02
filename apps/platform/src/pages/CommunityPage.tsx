import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ForumCategoryList } from '../components/community/ForumCategoryList';
import { Button } from '../components/shared/Button';
import { forumApi, type ForumCategory } from '../api/forum';
import { useAuth } from '../contexts/AuthContext';

export function CommunityPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await forumApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
          <h1 style={{ margin: 0 }}>Community Forum</h1>
          {user && (
            <Link to="/messages">
              <Button variant="secondary">
                💬 Messages
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            Loading categories...
          </div>
        ) : (
          <ForumCategoryList categories={categories} onCategoryUpdate={loadCategories} />
        )}
      </div>
    </Layout>
  );
}
