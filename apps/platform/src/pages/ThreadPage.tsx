import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ForumLayout } from '../components/community/ForumLayout';
import { ForumSidebar } from '../components/community/ForumSidebar';
import { ForumThreadView } from '../components/community/ForumThreadView';
import { Card } from '../components/shared/Card';
import { forumApi, type ForumThread, type ForumPost, type ForumCategory } from '../api/forum';
import { useWebSocket, type WebSocketMessage } from '../hooks/useWebSocket';

export function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [loading, setLoading] = useState(true);
  const sortBy = (searchParams.get('sort') as 'new' | 'top') || 'new';

  useEffect(() => {
    void forumApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (id) {
      void loadThread();
    }
  }, [id, sortBy]);

  // Handle WebSocket updates
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    if (message.type === 'forum:post:new' && message.threadId === id) {
      // New post in this thread - reload
      void loadThread();
    } else if (message.type === 'forum:post:updated' && message.post.threadId === id) {
      // Update post in list
      setPosts(prev => prev.map(p => 
        p.id === message.post.id ? { ...p, ...message.post } : p
      ));
    } else if (message.type === 'forum:post:deleted' && message.threadId === id) {
      // Remove deleted post
      setPosts(prev => prev.filter(p => p.id !== message.postId));
      // Also reload thread to update post count
      void loadThread();
    } else if (message.type === 'forum:thread:updated' && message.thread.id === id) {
      // Update thread data
      setThread(prev => prev ? { ...prev, ...message.thread } : null);
    } else if (message.type === 'forum:reaction:new') {
      if (message.postId) {
        // Reaction on post
        setPosts(prev => prev.map(p => {
          if (p.id === message.postId) {
            const reactions = [...p.reactions];
            if (!reactions.some(r => r.userId === message.reaction.userId && r.emoji === message.reaction.emoji)) {
              reactions.push(message.reaction);
            }
            return { ...p, reactions };
          }
          return p;
        }));
      } else if (message.threadId === id) {
        // Reaction on thread
        setThread(prev => {
          if (!prev) return prev;
          const reactions = [...prev.reactions];
          if (!reactions.some(r => r.userId === message.reaction.userId && r.emoji === message.reaction.emoji)) {
            reactions.push(message.reaction);
          }
          return { ...prev, reactions };
        });
      }
    } else if (message.type === 'forum:reaction:removed') {
      if (message.postId) {
        // Remove reaction from post
        setPosts(prev => prev.map(p => {
          if (p.id === message.postId) {
            return {
              ...p,
              reactions: p.reactions.filter(r => !(r.userId === message.userId && r.emoji === message.emoji))
            };
          }
          return p;
        }));
      } else if (message.threadId === id) {
        // Remove reaction from thread
        setThread(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            reactions: prev.reactions.filter(r => !(r.userId === message.userId && r.emoji === message.emoji))
          };
        });
      }
    } else if (message.type === 'forum:vote:changed') {
      if (message.postId) {
        // Vote on post
        setPosts(prev => prev.map(p => 
          p.id === message.postId ? { 
            ...p, 
            score: message.score, 
            upvotes: message.upvotes, 
            downvotes: message.downvotes 
          } : p
        ));
      } else if (message.threadId === id) {
        // Vote on thread
        setThread(prev => prev ? {
          ...prev,
          score: message.score,
          upvotes: message.upvotes,
          downvotes: message.downvotes
        } : null);
      }
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  const loadThread = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await forumApi.getThread(id, sortBy);
      setThread(data.thread);
      setPosts(data.posts);
      setUserVote(data.userVote);
    } catch (error) {
      console.error('Failed to load thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThreadUpdate = () => {
    void loadThread();
  };

  const handleSortChange = (newSort: 'new' | 'top') => {
    setSearchParams({ sort: newSort });
  };

  if (loading) {
    return (
      <Layout>
        <ForumLayout sidebar={<ForumSidebar categories={categories} />}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            Loading thread...
          </div>
        </ForumLayout>
      </Layout>
    );
  }

  if (!thread) {
    return (
      <Layout>
        <ForumLayout sidebar={<ForumSidebar categories={categories} />}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            Thread not found
          </div>
        </ForumLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <ForumLayout
        sidebar={<ForumSidebar categories={categories} activeCategoryId={thread.categoryId} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          {/* Breadcrumbs */}
          <div>
            <Link
              to={`/community/category/${thread.categoryId}`}
              style={{
                color: 'var(--text-2)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
              }}
            >
              ← Back to Category
            </Link>
          </div>

          {/* Sort buttons */}
          <Card>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
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

          <ForumThreadView
            thread={thread}
            posts={posts}
            userVote={userVote}
            onThreadUpdate={handleThreadUpdate}
          />
        </div>
      </ForumLayout>
    </Layout>
  );
}
