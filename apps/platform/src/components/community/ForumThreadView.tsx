import { useState, useEffect, useRef } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { ForumPostEditor } from './ForumPostEditor';
import { ForumReactions } from './ForumReactions';
import { ThreadBadges } from './ThreadBadges';
import { PostContent } from './PostContent';
import { forumApi, type ForumThread, type ForumPost } from '../../api/forum';
import { useAuth } from '../../contexts/AuthContext';
import { profilesApi, type UserProfile } from '../../api/profiles';
import { Link } from 'react-router-dom';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

interface ForumThreadViewProps {
  thread: ForumThread;
  posts: ForumPost[];
  userVote: 'up' | 'down' | null;
  onThreadUpdate: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString();
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function PostCard({ post, onUpdate }: { post: ForumPost; onUpdate: () => void }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [postScore, setPostScore] = useState({ score: post.score || 0, upvotes: post.upvotes || 0, downvotes: post.downvotes || 0 });
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(post.userVote || null);
  const [currentPost, setCurrentPost] = useState(post);

  // Sync local state with post prop when post changes (from WebSocket updates)
  useEffect(() => {
    setCurrentPost(post);
    setPostScore({ 
      score: post.score || 0, 
      upvotes: post.upvotes || 0, 
      downvotes: post.downvotes || 0 
    });
    setUserVote(post.userVote || null);
    if (!isEditing) {
      setEditContent(post.content);
    }
  }, [post.id, post.score, post.upvotes, post.downvotes, post.userVote, post.reactions, isEditing]);

  useEffect(() => {
    void profilesApi.getProfile(post.authorId)
      .then(setUserProfile)
      .catch(() => setUserProfile(null));
  }, [post.authorId]);

  const handleVote = async (vote: 'up' | 'down') => {
    if (!user) return;
    
    try {
      if (userVote === vote) {
        // Remove vote
        const result = await forumApi.removePostVote(currentPost.id);
        setPostScore(result);
        setUserVote(null);
      } else {
        // Change or add vote
        const result = await forumApi.votePost(currentPost.id, vote);
        setPostScore(result);
        setUserVote(vote);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await forumApi.updatePost(currentPost.id, editContent);
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to update post:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await forumApi.deletePost(currentPost.id);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const displayName = userProfile?.displayName || userProfile?.email?.split('@')[0] || `User ${currentPost.authorId.substring(0, 8)}`;

  return (
    <Card>
      <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
        {/* Voting section */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: 'var(--spacing-1)',
          minWidth: '40px',
        }}>
          <button
            onClick={() => handleVote('up')}
            disabled={!user}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: user ? 'pointer' : 'default',
              color: userVote === 'up' ? '#4ade80' : 'var(--text-3)',
              fontSize: '1.2em',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ▲
          </button>
          <div style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-semibold)',
            color: postScore.score > 0 ? '#4ade80' : postScore.score < 0 ? '#ef4444' : 'var(--text-2)',
          }}>
            {postScore.score}
          </div>
          <button
            onClick={() => handleVote('down')}
            disabled={!user}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: user ? 'pointer' : 'default',
              color: userVote === 'down' ? '#ef4444' : 'var(--text-3)',
              fontSize: '1.2em',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ▼
          </button>
        </div>

        {/* Post content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
            <Link
              to={`/profile/${currentPost.authorId}`}
              style={{
                fontWeight: 'var(--font-semibold)',
                color: 'var(--text-1)',
                textDecoration: 'none',
              }}
            >
              {displayName}
            </Link>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
              {formatTimeAgo(currentPost.createdAt)}
              {currentPost.editedAt && ' (edited)'}
            </span>
            {user && (user.id === currentPost.authorId || user.role === 'admin' || user.role === 'moderator') && (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)',
                    padding: 0,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-error)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)',
                    padding: 0,
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>

          {isEditing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: 'var(--spacing-2)',
                  background: 'var(--bg-button)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-1)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--text-sm)',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                <Button size="small" onClick={handleSaveEdit}>Save</Button>
                <Button size="small" variant="secondary" onClick={() => { setIsEditing(false); setEditContent(currentPost.content); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 'var(--spacing-3)' }}>
                <PostContent content={currentPost.content} />
              </div>
              <ForumReactions
                reactions={currentPost.reactions}
                onAddReaction={(emoji) => {
                  forumApi.addPostReaction(currentPost.id, emoji).then(() => onUpdate()).catch(console.error);
                }}
                onRemoveReaction={(emoji) => {
                  forumApi.removePostReaction(currentPost.id, emoji).then(() => onUpdate()).catch(console.error);
                }}
                disabled={!user}
              />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ForumThreadView({ thread, posts, userVote: initialUserVote, onThreadUpdate }: ForumThreadViewProps) {
  const { user } = useAuth();
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [threadScore, setThreadScore] = useState({ score: thread.score, upvotes: thread.upvotes, downvotes: thread.downvotes });
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(initialUserVote);
  const [currentThread, setCurrentThread] = useState(thread);
  const [currentPosts, setCurrentPosts] = useState(posts);
  const postsEndRef = useRef<HTMLDivElement>(null);

  // Update local state when props change
  useEffect(() => {
    setCurrentThread(thread);
    setCurrentPosts(posts);
    setThreadScore({ score: thread.score, upvotes: thread.upvotes, downvotes: thread.downvotes });
    setUserVote(initialUserVote);
  }, [thread, posts, initialUserVote]);

  useEffect(() => {
    void profilesApi.getProfile(currentThread.authorId)
      .then(setUserProfile)
      .catch(() => setUserProfile(null));
  }, [currentThread.authorId]);

  useEffect(() => {
    postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentPosts]);

  // Handle WebSocket updates
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    if (message.type === 'forum:post:new' && message.threadId === currentThread.id) {
      // Add new post to list
      setCurrentPosts(prev => {
        // Avoid duplicates
        if (prev.some(p => p.id === message.post.id)) {
          return prev;
        }
        return [...prev, message.post as ForumPost];
      });
      // Scroll to bottom
      setTimeout(() => {
        postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else if (message.type === 'forum:post:updated' && message.post.threadId === currentThread.id) {
      // Update post
      setCurrentPosts(prev => prev.map(p => 
        p.id === message.post.id ? { ...p, ...message.post } : p
      ));
    } else if (message.type === 'forum:post:deleted' && message.threadId === currentThread.id) {
      // Remove post
      setCurrentPosts(prev => prev.filter(p => p.id !== message.postId));
      // Reload thread to update post count
      onThreadUpdate();
    } else if (message.type === 'forum:reaction:new') {
      if (message.postId) {
        // Reaction on post
        setCurrentPosts(prev => prev.map(p => {
          if (p.id === message.postId) {
            const reactions = [...p.reactions];
            if (!reactions.some(r => r.userId === message.reaction.userId && r.emoji === message.reaction.emoji)) {
              reactions.push(message.reaction);
            }
            return { ...p, reactions };
          }
          return p;
        }));
      } else if (message.threadId === currentThread.id) {
        // Reaction on thread
        setCurrentThread(prev => {
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
        setCurrentPosts(prev => prev.map(p => {
          if (p.id === message.postId) {
            return {
              ...p,
              reactions: p.reactions.filter(r => !(r.userId === message.userId && r.emoji === message.emoji))
            };
          }
          return p;
        }));
      } else if (message.threadId === currentThread.id) {
        // Remove reaction from thread
        setCurrentThread(prev => ({
          ...prev,
          reactions: prev.reactions.filter(r => !(r.userId === message.userId && r.emoji === message.emoji))
        }));
      }
    } else if (message.type === 'forum:vote:changed') {
      if (message.postId) {
        // Vote on post
        setCurrentPosts(prev => prev.map(p => 
          p.id === message.postId ? { 
            ...p, 
            score: message.score, 
            upvotes: message.upvotes, 
            downvotes: message.downvotes 
          } : p
        ));
      } else if (message.threadId === currentThread.id) {
        // Vote on thread
        setThreadScore({
          score: message.score,
          upvotes: message.upvotes,
          downvotes: message.downvotes
        });
        setCurrentThread(prev => ({
          ...prev,
          score: message.score,
          upvotes: message.upvotes,
          downvotes: message.downvotes
        }));
      }
    } else if (message.type === 'forum:thread:updated' && message.thread.id === currentThread.id) {
      // Update thread data
      setCurrentThread(prev => ({ ...prev, ...message.thread }));
      onThreadUpdate();
    }
  };

  useWebSocket(handleWebSocketMessage, true);

  const handleThreadVote = async (vote: 'up' | 'down') => {
    if (!user) return;
    
    try {
      if (userVote === vote) {
        // Remove vote
        const result = await forumApi.removeThreadVote(thread.id);
        setThreadScore(result);
        setUserVote(null);
      } else {
        // Change or add vote
        const result = await forumApi.voteThread(thread.id, vote);
        setThreadScore(result);
        setUserVote(vote);
      }
      onThreadUpdate();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handlePostCreated = () => {
    setShowReplyEditor(false);
    onThreadUpdate();
  };

  const displayName = userProfile?.displayName || userProfile?.email?.split('@')[0] || `User ${thread.authorId.substring(0, 8)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      {/* Thread header */}
      <Card>
        <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
          {/* Voting section */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 'var(--spacing-1)',
            minWidth: '40px',
          }}>
            <button
              onClick={() => handleThreadVote('up')}
              disabled={!user}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: user ? 'pointer' : 'default',
                color: userVote === 'up' ? '#4ade80' : 'var(--text-3)',
                fontSize: '1.5em',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ▲
            </button>
            <div style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-bold)',
              color: threadScore.score > 0 ? '#4ade80' : threadScore.score < 0 ? '#ef4444' : 'var(--text-2)',
            }}>
              {threadScore.score}
            </div>
            <button
              onClick={() => handleThreadVote('down')}
              disabled={!user}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: user ? 'pointer' : 'default',
                color: userVote === 'down' ? '#ef4444' : 'var(--text-3)',
                fontSize: '1.5em',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ▼
            </button>
          </div>

          {/* Thread content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ThreadBadges isPinned={currentThread.isPinned} isLocked={currentThread.isLocked} tags={currentThread.tags} />
            <h1 style={{
              margin: 'var(--spacing-2) 0',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text-1)',
            }}>
              {currentThread.title}
            </h1>
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <PostContent content={currentThread.content} />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-3)',
            }}>
              <span>by</span>
              <Link
                to={`/profile/${currentThread.authorId}`}
                style={{
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--text-1)',
                  textDecoration: 'none',
                }}
              >
                {displayName}
              </Link>
              <span>•</span>
              <span>{formatTimeAgo(currentThread.createdAt)}</span>
              <span>•</span>
              <span>{currentThread.postCount} {currentThread.postCount === 1 ? 'reply' : 'replies'}</span>
            </div>
            <ForumReactions
              reactions={currentThread.reactions}
              onAddReaction={(emoji) => {
                forumApi.addThreadReaction(currentThread.id, emoji).then(() => onThreadUpdate()).catch(console.error);
              }}
              onRemoveReaction={(emoji) => {
                forumApi.removeThreadReaction(currentThread.id, emoji).then(() => onThreadUpdate()).catch(console.error);
              }}
              disabled={!user}
            />
          </div>
        </div>
      </Card>

      {/* Posts */}
      {currentPosts.map(post => (
        <PostCard key={post.id} post={post} onUpdate={onThreadUpdate} />
      ))}

      {/* Reply editor */}
      {!currentThread.isLocked && user && (
        <Card>
          {showReplyEditor ? (
          <ForumPostEditor
            threadId={currentThread.id}
            onPostCreated={handlePostCreated}
            onCancel={() => setShowReplyEditor(false)}
          />
        ) : (
          <Button onClick={() => setShowReplyEditor(true)}>Add Reply</Button>
        )}
        </Card>
      )}

      {currentThread.isLocked && (
        <Card>
          <p style={{ textAlign: 'center', color: 'var(--text-2)', margin: 0 }}>
            This thread is locked. No new replies can be posted.
          </p>
        </Card>
      )}

      <div ref={postsEndRef} />
    </div>
  );
}
