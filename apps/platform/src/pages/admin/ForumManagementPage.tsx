import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';
import { ForumCategoryEditor } from '../../components/admin/ForumCategoryEditor';
import { adminApi } from '../../api/admin';
import { forumApi } from '../../api/forum';
import type { ForumCategory, ForumThread, ForumPost } from '../../api/forum';

type Tab = 'categories' | 'threads' | 'posts';

export function ForumManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categories');
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<ForumCategory | null>(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Threads pagination
  const [threadPage, setThreadPage] = useState(1);
  const [threadTotal, setThreadTotal] = useState(0);
  const [threadSearch, setThreadSearch] = useState('');
  const threadPageSize = 20;

  // Posts pagination
  const [postPage, setPostPage] = useState(1);
  const [postTotal, setPostTotal] = useState(0);
  const [postSearch, setPostSearch] = useState('');
  const postPageSize = 20;

  useEffect(() => {
    if (activeTab === 'categories') {
      loadCategories();
      loadStats();
    } else if (activeTab === 'threads') {
      loadThreads();
    } else if (activeTab === 'posts') {
      loadPosts();
    }
  }, [activeTab, threadPage, postPage, threadSearch, postSearch]);

  const loadStats = async () => {
    try {
      const data = await adminApi.getForumStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load forum stats:', error);
    }
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getForumCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadThreads = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getForumThreads({
        limit: threadPageSize,
        offset: (threadPage - 1) * threadPageSize,
        search: threadSearch || undefined,
      });
      setThreads(response.threads);
      setThreadTotal(response.total);
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getForumPosts({
        limit: postPageSize,
        offset: (postPage - 1) * postPageSize,
        search: postSearch || undefined,
      });
      setPosts(response.posts);
      setPostTotal(response.total);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async (categoryData: Partial<ForumCategory>) => {
    try {
      if (editingCategory) {
        await adminApi.updateForumCategory(editingCategory.id, categoryData);
      } else {
        // Create new category - backend generates ID
        await forumApi.createCategory({
          name: categoryData.name!,
          description: categoryData.description,
          icon: categoryData.icon,
          color: categoryData.color,
          order: categoryData.order,
          isLocked: categoryData.isLocked,
        });
      }
      setShowCategoryEditor(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This cannot be undone.')) {
      return;
    }
    try {
      await adminApi.deleteForumCategory(id);
      await loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete category');
    }
  };

  const handleDeleteThread = async (id: string) => {
    if (!confirm('Are you sure you want to delete this thread? This will also delete all posts.')) {
      return;
    }
    try {
      await adminApi.deleteForumThread(id);
      await loadThreads();
    } catch (error) {
      console.error('Failed to delete thread:', error);
      alert('Failed to delete thread');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }
    try {
      await adminApi.deleteForumPost(id);
      await loadPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    }
  };

  const handlePurgeForum = async () => {
    const confirmMessage = '⚠️ WARNING: This will DELETE ALL forum threads and posts!\n\n' +
      'This action cannot be undone. Are you absolutely sure?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    // Double confirmation
    if (!confirm('Are you REALLY sure? This will permanently delete all forum content.')) {
      return;
    }

    try {
      setLoading(true);
      const result = await adminApi.purgeForum();
      alert(`Success: ${result.message}`);
      // Reload stats and data
      await loadStats();
      await loadThreads();
      await loadPosts();
    } catch (error) {
      console.error('Failed to purge forum:', error);
      alert(error instanceof Error ? error.message : 'Failed to purge forum');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Forum Management</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)' }}>
          <button
            onClick={() => setActiveTab('categories')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'categories' ? 'var(--bg-button-primary)' : 'transparent',
              color: activeTab === 'categories' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              borderBottom: activeTab === 'categories' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
            }}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('threads')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'threads' ? 'var(--bg-button-primary)' : 'transparent',
              color: activeTab === 'threads' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              borderBottom: activeTab === 'threads' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
            }}
          >
            Threads
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'posts' ? 'var(--bg-button-primary)' : 'transparent',
              color: activeTab === 'posts' ? 'white' : 'var(--text-1)',
              cursor: 'pointer',
              borderBottom: activeTab === 'posts' ? '2px solid var(--bg-button-primary)' : '2px solid transparent',
            }}
          >
            Posts
          </button>
        </div>

        {/* Stats */}
        {stats && activeTab === 'categories' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <Card>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.categories.total}</div>
                <div style={{ color: 'var(--text-secondary, #666)' }}>Categories</div>
              </Card>
              <Card>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.threads.total}</div>
                <div style={{ color: 'var(--text-secondary, #666)' }}>Threads</div>
              </Card>
              <Card>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.posts.total}</div>
                <div style={{ color: 'var(--text-secondary, #666)' }}>Posts</div>
              </Card>
              <Card>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.threads.last24h}</div>
                <div style={{ color: 'var(--text-secondary, #666)' }}>New Threads (24h)</div>
              </Card>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={handlePurgeForum}
                disabled={loading}
                style={{
                  background: 'var(--bg-error, #ffebee)',
                  color: 'var(--color-error, #c62828)',
                  border: '1px solid var(--color-error, #c62828)',
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem',
                }}
              >
                {loading ? 'Purging...' : '⚠️ Purge All Forum Content'}
              </Button>
            </div>
          </>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryEditor(true);
                }}
              >
                Create Category
              </Button>
            </div>

            {showCategoryEditor && (
              <div style={{ marginBottom: '1.5rem' }}>
                <ForumCategoryEditor
                  category={editingCategory || undefined}
                  onSave={handleSaveCategory}
                  onCancel={() => {
                    setShowCategoryEditor(false);
                    setEditingCategory(null);
                  }}
                />
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {categories.map((category) => (
                  <Card key={category.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{category.icon || '📁'}</span>
                          <h3 style={{ fontSize: '1.125rem', margin: 0 }}>{category.name}</h3>
                          {category.isLocked && (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-error, #ffebee)',
                              fontSize: '0.75rem',
                            }}>
                              Locked
                            </span>
                          )}
                        </div>
                        <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '0.5rem' }}>
                          {category.description}
                        </p>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                          Threads: {category.threadCount} | Posts: {category.postCount} | Order: {category.order}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setEditingCategory(category);
                            setShowCategoryEditor(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleDeleteCategory(category.id)}
                          style={{ background: 'var(--bg-error, #ffebee)', color: 'var(--color-error, #c62828)' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Threads Tab */}
        {activeTab === 'threads' && (
          <>
            <Card style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Search threads..."
                value={threadSearch}
                onChange={(e) => {
                  setThreadSearch(e.target.value);
                  setThreadPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </Card>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                  {threads.map((thread) => (
                    <Card key={thread.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>{thread.title}</h3>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                            Author: {thread.authorId} | 
                            Created: {new Date(thread.createdAt).toLocaleString()} | 
                            Posts: {thread.postCount} | 
                            Score: {thread.score}
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleDeleteThread(thread.id)}
                          style={{ background: 'var(--bg-error, #ffebee)', color: 'var(--color-error, #c62828)' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {threadTotal > threadPageSize && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setThreadPage(p => Math.max(1, p - 1))}
                      disabled={threadPage === 1}
                    >
                      Previous
                    </Button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                      Page {threadPage} of {Math.ceil(threadTotal / threadPageSize)}
                    </span>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setThreadPage(p => p + 1)}
                      disabled={threadPage >= Math.ceil(threadTotal / threadPageSize)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <>
            <Card style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Search posts..."
                value={postSearch}
                onChange={(e) => {
                  setPostSearch(e.target.value);
                  setPostPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
            </Card>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                  {posts.map((post) => (
                    <Card key={post.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ marginBottom: '0.5rem' }}>
                            {post.content.length > 200 ? `${post.content.substring(0, 200)}...` : post.content}
                          </p>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #666)' }}>
                            Author: {post.authorId} | 
                            Created: {new Date(post.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => handleDeletePost(post.id)}
                          style={{ background: 'var(--bg-error, #ffebee)', color: 'var(--color-error, #c62828)' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {postTotal > postPageSize && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setPostPage(p => Math.max(1, p - 1))}
                      disabled={postPage === 1}
                    >
                      Previous
                    </Button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                      Page {postPage} of {Math.ceil(postTotal / postPageSize)}
                    </span>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setPostPage(p => p + 1)}
                      disabled={postPage >= Math.ceil(postTotal / postPageSize)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

