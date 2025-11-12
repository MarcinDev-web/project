import { useState, useEffect, useRef } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { VotingButtons } from './VotingButtons';
import { ForumPostEditor } from './ForumPostEditor';
import { ForumReactions } from './ForumReactions';
import { ThreadBadges } from './ThreadBadges';
import { ThreadActions } from './ThreadActions';
import { PostContent } from './PostContent';
import { PostCard } from './PostCard';
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

  const displayName = userProfile?.displayName || userProfile?.username || userProfile?.email?.split('@')[0] || `User ${thread.authorId.substring(0, 8)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      {/* Thread header */}
      <Card variant="post">
        <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
          {/* Voting section */}
          <div className="forum-post__voting">
            <VotingButtons
              score={threadScore.score}
              userVote={userVote}
              onVote={handleThreadVote}
              size="lg"
              variant="thread"
              disabled={!user}
            />
          </div>

          {/* Thread content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ThreadBadges 
              isPinned={currentThread.isPinned} 
              isLocked={currentThread.isLocked} 
              tags={currentThread.tags}
              isSolved={currentThread.isSolved}
            />
            <h1 style={{
              margin: 'var(--spacing-2) 0',
              fontSize: 'var(--forum-title-xl)',
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
              justifyContent: 'space-between',
              gap: 'var(--spacing-2)',
              flexWrap: 'wrap',
            }}>
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
              {user && (
                <ThreadActions
                  threadId={currentThread.id}
                  isFollowed={currentThread.isFollowed}
                  isBookmarked={currentThread.isBookmarked}
                  isSolved={currentThread.isSolved}
                  isAuthor={user.id === currentThread.authorId}
                  onUpdate={onThreadUpdate}
                />
              )}
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
        <PostCard 
          key={post.id} 
          post={post} 
          threadAuthorId={currentThread.authorId}
          onUpdate={onThreadUpdate} 
        />
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
