import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import { VotingButtons } from './VotingButtons';
import { ForumReactions } from './ForumReactions';
import { PostContent } from './PostContent';
import type { ForumPost } from '../../api/forum';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { profilesApi, type UserProfile } from '../../api/profiles';
import { forumApi } from '../../api/forum';

export interface PostCardProps {
  post: ForumPost;
  threadAuthorId?: string;
  onUpdate?: () => void;
  onReply?: () => void;
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

/**
 * Post Card Component
 * 
 * Reddit-style post card with voting, avatar, user badges, and actions
 */
export function PostCard({ post, threadAuthorId, onUpdate, onReply }: PostCardProps) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(post.userVote || null);
  const [score, setScore] = useState({ 
    score: post.score || 0, 
    upvotes: post.upvotes || 0, 
    downvotes: post.downvotes || 0 
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  useEffect(() => {
    void profilesApi.getProfile(post.authorId)
      .then(setUserProfile)
      .catch(() => setUserProfile(null));
  }, [post.authorId]);

  useEffect(() => {
    setScore({ 
      score: post.score || 0, 
      upvotes: post.upvotes || 0, 
      downvotes: post.downvotes || 0 
    });
    setUserVote(post.userVote || null);
    if (!isEditing) {
      setEditContent(post.content);
    }
  }, [post.score, post.upvotes, post.downvotes, post.userVote, post.content, isEditing]);

  const handleVote = async (vote: 'up' | 'down') => {
    if (!user) return;
    
    try {
      if (userVote === vote) {
        // Remove vote
        const result = await forumApi.removePostVote(post.id);
        setScore(result);
        setUserVote(null);
      } else {
        // Change or add vote
        const result = await forumApi.votePost(post.id, vote);
        setScore(result);
        setUserVote(vote);
      }
      onUpdate?.();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await forumApi.updatePost(post.id, editContent);
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update post:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await forumApi.deletePost(post.id);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const displayName = userProfile?.displayName || userProfile?.username || userProfile?.email?.split('@')[0] || `User ${post.authorId.substring(0, 8)}`;
  const isOP = threadAuthorId === post.authorId;
  const canEdit = user && (user.id === post.authorId || user.role === 'admin' || user.role === 'moderator');

  return (
    <Card variant="post">
      <div className="forum-post__voting">
        <VotingButtons
          score={score.score}
          userVote={userVote}
          onVote={handleVote}
          size="md"
          variant="post"
          disabled={!user}
        />
      </div>

      <div className="forum-post__content">
        <div className="forum-post__header">
          {userProfile && (
            <img
              src={userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
              alt={displayName}
              className="forum-post__avatar"
            />
          )}
          
          <div className="forum-post__author">
            <Link
              to={`/profile/${post.authorId}`}
              className="forum-post__author-name"
            >
              {displayName}
            </Link>
            {isOP && (
              <span className="forum-user-badge forum-user-badge--op">
                OP
              </span>
            )}
            {user?.role === 'admin' && (
              <span className="forum-user-badge forum-user-badge--admin">
                Admin
              </span>
            )}
            {user?.role === 'moderator' && (
              <span className="forum-user-badge forum-user-badge--moderator">
                Mod
              </span>
            )}
          </div>

          <span style={{ fontSize: 'var(--forum-meta)', color: 'var(--text-3)' }}>
            {formatTimeAgo(post.createdAt)}
            {post.editedAt && ' (edited)'}
          </span>

          {canEdit && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  fontSize: 'var(--forum-meta)',
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
                  fontSize: 'var(--forum-meta)',
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
                background: 'var(--forum-bg-input)',
                border: '1px solid var(--forum-border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-1)',
                fontFamily: 'inherit',
                fontSize: 'var(--forum-body)',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: 'var(--bg-button-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditContent(post.content); }}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: 'var(--bg-button)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="forum-post__body">
              <PostContent content={post.content} />
            </div>

            <div className="forum-post__footer">
              <ForumReactions
                reactions={post.reactions}
                onAddReaction={(emoji) => {
                  forumApi.addPostReaction(post.id, emoji).then(() => onUpdate?.()).catch(console.error);
                }}
                onRemoveReaction={(emoji) => {
                  forumApi.removePostReaction(post.id, emoji).then(() => onUpdate?.()).catch(console.error);
                }}
                disabled={!user}
              />
              {onReply && user && (
                <button
                  onClick={onReply}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--forum-meta)',
                    padding: 0,
                  }}
                >
                  Reply
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

