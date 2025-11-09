import { useState, useEffect } from 'react';
import { ForumCategoryList } from '../community/ForumCategoryList';
import { forumApi, type ForumCategory } from '../../api/forum';

export function CommunityTab() {
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
    <div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
          Loading categories...
        </div>
      ) : (
        <ForumCategoryList categories={categories} onCategoryUpdate={loadCategories} />
      )}
    </div>
  );
}

