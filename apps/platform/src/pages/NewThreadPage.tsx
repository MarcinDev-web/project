import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { forumApi, type ForumCategory } from '../api/forum';
import { useAuth } from '../contexts/AuthContext';

export function NewThreadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('category') || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await forumApi.getCategories();
      setCategories(data);
      if (!selectedCategoryId && data.length > 0 && data[0]) {
        setSelectedCategoryId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !selectedCategoryId) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const thread = await forumApi.createThread({
        categoryId: selectedCategoryId,
        title: title.trim(),
        content: content.trim(),
        tags: tagsArray,
      });
      navigate(`/community/thread/${thread.id}`);
    } catch (error) {
      console.error('Failed to create thread:', error);
      alert('Failed to create thread. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="page-container">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            Please log in to create a thread.
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ marginBottom: 'var(--spacing-6)' }}>Create New Thread</h1>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: 'var(--font-semibold)' }}>
                Category *
              </label>
              {loading ? (
                <div>Loading categories...</div>
              ) : (
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-2)',
                    background: 'var(--bg-button)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-1)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon && `${cat.icon} `}{cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: 'var(--font-semibold)' }}>
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter thread title"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2)',
                  background: 'var(--bg-button)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-1)',
                  fontSize: 'var(--text-base)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: 'var(--font-semibold)' }}>
                Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post content... (Markdown supported)"
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: 'var(--spacing-3)',
                  background: 'var(--bg-button)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-1)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--text-sm)',
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: 'var(--font-semibold)' }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., help, bug, feature"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2)',
                  background: 'var(--bg-button)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-1)',
                  fontSize: 'var(--text-sm)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => navigate('/community')}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Thread'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
