import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Card } from '../../components/shared/Card';
import { Button } from '../../components/shared/Button';
import { ForumThreadModeration } from '../../components/moderator/ForumThreadModeration';
import { ForumPostModeration } from '../../components/moderator/ForumPostModeration';
import { moderatorApi } from '../../api/moderator';
import { forumApi } from '../../api/forum';
import type { ForumThread, ForumPost } from '../../api/forum';

type Tab = 'threads' | 'posts';

export function ForumModerationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('threads');
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadPage, setThreadPage] = useState(1);
  const [threadTotal, setThreadTotal] = useState(0);
  const [threadSearch, setThreadSearch] = useState('');
  const threadPageSize = 20;

  const [postPage, setPostPage] = useState(1);
  const [postTotal, setPostTotal] = useState(0);
  const [postSearch, setPostSearch] = useState('');
  const postPageSize = 20;

  useEffect(() => {
    if (activeTab === 'threads') {
      loadThreads();
    } else {
      loadPosts();
    }
  }, [activeTab, threadPage, postPage, threadSearch, postSearch]);

  const loadThreads = async () => {
    setLoading(true);
    try {
      const response = await moderatorApi.getForumThreads({
        limit: threadPageSize,
        offset: (threadPage - 1) * threadPageSize,
        ...(threadSearch && { search: threadSearch }),
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
      const response = await moderatorApi.getForumPosts({
        limit: postPageSize,
        offset: (postPage - 1) * postPageSize,
        ...(postSearch && { search: postSearch }),
      });
      setPosts(response.posts);
      setPostTotal(response.total);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveThread = async (id: string) => {
    try {
      await moderatorApi.approveForumThread(id);
      await loadThreads();
    } catch (error) {
      console.error('Failed to approve thread:', error);
      alert('Failed to approve thread');
    }
  };

  const handleRejectThread = async (id: string) => {
    const reason = prompt('Rejection reason (optional):');
    try {
      await moderatorApi.rejectForumThread(id, reason || undefined);
      await loadThreads();
    } catch (error) {
      console.error('Failed to reject thread:', error);
      alert('Failed to reject thread');
    }
  };

  const handleDeleteThread = async (id: string) => {
    if (!confirm('Are you sure you want to delete this thread?')) {
      return;
    }
    try {
      await moderatorApi.deleteForumThread(id);
      await loadThreads();
    } catch (error) {
      console.error('Failed to delete thread:', error);
      alert('Failed to delete thread');
    }
  };

  const handleWarnThread = async (id: string, authorId: string) => {
    const reason = prompt('Warning reason (optional):');
    try {
      await moderatorApi.warnForumThreadAuthor(id, reason || undefined);
      alert(`User ${authorId} has been warned`);
    } catch (error) {
      console.error('Failed to warn user:', error);
      alert('Failed to warn user');
    }
  };

  const handleLockThread = async (id: string) => {
    try {
      await forumApi.lockThread(id);
      await loadThreads();
    } catch (error) {
      console.error('Failed to lock thread:', error);
      alert('Failed to lock thread');
    }
  };

  const handleUnlockThread = async (id: string) => {
    try {
      await forumApi.unlockThread(id);
      await loadThreads();
    } catch (error) {
      console.error('Failed to unlock thread:', error);
      alert('Failed to unlock thread');
    }
  };

  const handlePinThread = async (id: string) => {
    try {
      await forumApi.pinThread(id);
      await loadThreads();
    } catch (error) {
      console.error('Failed to pin thread:', error);
      alert('Failed to pin thread');
    }
  };

  const handleUnpinThread = async (id: string) => {
    try {
      await forumApi.unpinThread(id);
      await loadThreads();
    } catch (error) {
      console.error('Failed to unpin thread:', error);
      alert('Failed to unpin thread');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }
    try {
      await moderatorApi.deleteForumPost(id);
      await loadPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    }
  };

  const handleWarnPost = async (id: string, authorId: string) => {
    const reason = prompt('Warning reason (optional):');
    try {
      await moderatorApi.warnForumPostAuthor(id, reason || undefined);
      alert(`User ${authorId} has been warned`);
    } catch (error) {
      console.error('Failed to warn user:', error);
      alert('Failed to warn user');
    }
  };

  // Load thread titles for posts
  const [threadTitles, setThreadTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    if (activeTab === 'posts' && posts.length > 0) {
      const threadIds = [...new Set(posts.map(p => p.threadId))];
      Promise.all(threadIds.map(async (threadId) => {
        try {
          const response = await forumApi.getThread(threadId);
          return { threadId, title: response.thread.title };
        } catch {
          return { threadId, title: 'Unknown Thread' };
        }
      })).then(results => {
        const titles: Record<string, string> = {};
        results.forEach(({ threadId, title }) => {
          titles[threadId] = title;
        });
        setThreadTitles(titles);
      });
    }
  }, [activeTab, posts]);

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Forum Moderation</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)' }}>
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
                    <ForumThreadModeration
                      key={thread.id}
                      thread={thread}
                      onApprove={() => handleApproveThread(thread.id)}
                      onReject={() => handleRejectThread(thread.id)}
                      onDelete={() => handleDeleteThread(thread.id)}
                      onWarn={() => handleWarnThread(thread.id, thread.authorId)}
                      {...(thread.isLocked ? {} : { onLock: () => handleLockThread(thread.id) })}
                      {...(thread.isLocked ? { onUnlock: () => handleUnlockThread(thread.id) } : {})}
                      {...(thread.isPinned ? {} : { onPin: () => handlePinThread(thread.id) })}
                      {...(thread.isPinned ? { onUnpin: () => handleUnpinThread(thread.id) } : {})}
                    />
                  ))}
                </div>

                {threads.length === 0 && !loading && (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #666)' }}>
                      No threads found
                    </div>
                  </Card>
                )}

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
                    <ForumPostModeration
                      key={post.id}
                      post={post}
                      {...(threadTitles[post.threadId] && { threadTitle: threadTitles[post.threadId] })}
                      onDelete={() => handleDeletePost(post.id)}
                      onWarn={() => handleWarnPost(post.id, post.authorId)}
                    />
                  ))}
                </div>

                {posts.length === 0 && !loading && (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary, #666)' }}>
                      No posts found
                    </div>
                  </Card>
                )}

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

