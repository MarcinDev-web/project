/**
 * News Admin Component
 */

import { useState, useEffect } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { adminApi, type NewsItem } from '../../api/admin';

export function NewsAdmin() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    published: '' as '' | 'true' | 'false',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    void loadNews();
  }, [page, filters.published, filters.search]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getNews({
        ...(filters.published !== '' && { published: filters.published === 'true' }),
        ...(filters.search && { search: filters.search }),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setNews(response.news);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load news:', error);
      alert('Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (itemData: Omit<NewsItem, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>) => {
    try {
      await adminApi.createNewsItem(itemData);
      await loadNews();
      setShowForm(false);
      alert('News item created successfully');
    } catch (error) {
      console.error('Failed to create news item:', error);
      alert('Failed to create news item');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<NewsItem>) => {
    try {
      await adminApi.updateNewsItem(id, updates);
      await loadNews();
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update news item:', error);
      alert('Failed to update news item');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this news item? This action cannot be undone.')) {
      try {
        await adminApi.deleteNewsItem(id);
        await loadNews();
      } catch (error) {
        console.error('Failed to delete news item:', error);
        alert('Failed to delete news item');
      }
    }
  };

  const handleTogglePublished = async (id: string, currentPublished: boolean) => {
    try {
      await handleUpdate(id, { published: !currentPublished });
    } catch (error) {
      console.error('Failed to toggle published status:', error);
    }
  };

  return (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
              placeholder="Search title or content..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-1)',
                borderRadius: 'var(--radius-1)',
              }}
            />
          </div>
          <div style={{ minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Status
            </label>
            <select
              value={filters.published}
              onChange={(e) => {
                setFilters({ ...filters, published: e.target.value as '' | 'true' | 'false' });
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-1)',
                borderRadius: 'var(--radius-1)',
              }}
            >
              <option value="">All</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </div>
          <Button onClick={() => setShowForm(true)}>Create News</Button>
        </div>
      </Card>

      {/* Create/Edit Form */}
      {showForm && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <h3>Create News Item</h3>
          <NewsForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {editingItem && (
        <Card style={{ marginBottom: '1.5rem' }}>
          <h3>Edit News Item</h3>
          <NewsForm
            item={editingItem}
            onSubmit={(data) => handleUpdate(editingItem.id, data)}
            onCancel={() => setEditingItem(null)}
          />
        </Card>
      )}

      {/* News List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem', color: 'var(--text-2)' }}>
            Showing {news.length} of {total} news items
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {news.map((item) => (
              <Card key={item.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0 }}>{item.title}</h3>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-1)',
                          fontSize: '0.75rem',
                          background: item.published ? 'var(--success)' : 'var(--warning)',
                          color: 'white',
                        }}
                      >
                        {item.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    {item.excerpt && (
                      <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)', fontSize: '0.875rem' }}>
                        {item.excerpt}
                      </p>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                      {item.authorName || item.authorId} •{' '}
                      {new Date(item.publishedAt || item.createdAt).toLocaleDateString()}
                      {item.tags && item.tags.length > 0 && (
                        <>
                          {' • '}
                          {item.tags.map((tag) => (
                            <span key={tag} style={{ marginRight: '0.25rem' }}>
                              #{tag}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <Button
                      size="small"
                      onClick={() => handleTogglePublished(item.id, item.published)}
                    >
                      {item.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button size="small" onClick={() => setEditingItem(item)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="danger"
                      onClick={() => handleDelete(item.id)}
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <Button
                size="small"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <Button
                size="small"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface NewsFormProps {
  item?: NewsItem;
  onSubmit: (data: {
    title: string;
    content: string;
    excerpt?: string;
    published?: boolean;
    tags?: string[];
    imageUrl?: string;
  }) => void;
  onCancel: () => void;
}

function NewsForm({ item, onSubmit, onCancel }: NewsFormProps) {
  const [title, setTitle] = useState(item?.title || '');
  const [content, setContent] = useState(item?.content || '');
  const [excerpt, setExcerpt] = useState(item?.excerpt || '');
  const [published, setPublished] = useState(item?.published ?? false);
  const [tags, setTags] = useState(item?.tags?.join(', ') || '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      alert('Title and content are required');
      return;
    }
    onSubmit({
      title,
      content,
      excerpt: excerpt || undefined,
      published,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      imageUrl: imageUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-1)',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          Excerpt (optional)
        </label>
        <input
          type="text"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Short summary..."
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-1)',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          Content *
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={10}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-1)',
            fontFamily: 'inherit',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="announcement, update, feature"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-1)',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
          Image URL (optional)
        </label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-1)',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          id="published"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        <label htmlFor="published" style={{ fontSize: '0.875rem' }}>
          Publish immediately
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{item ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

