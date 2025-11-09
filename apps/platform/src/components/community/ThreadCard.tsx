import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import { VotingButtons } from './VotingButtons';
import { ThreadBadges } from './ThreadBadges';
import type { ForumThread } from '../../api/forum';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { profilesApi, type UserProfile } from '../../api/profiles';
import { forumApi } from '../../api/forum';

export interface ThreadCardProps {
  thread: ForumThread;
  onVote?: () => void;
  showCategory?: boolean;
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
 * Thread Card Component
 * 
 * Reddit-style thread card with voting, avatar, preview, and stats
 */
export function ThreadCard({ thread, onVote, showCategory = false }: ThreadCardProps) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [score, setScore] = useState(thread.score);

  useEffect(() => {
    void profilesApi.getProfile(thread.authorId)
      .then(setUserProfile)
      .catch(() => setUserProfile(null));
  }, [thread.authorId]);

  const handleVote = async (vote: 'up' | 'down') => {
    if (!user) return;
    
    try {
      if (userVote === vote) {
        // Remove vote
        const result = await forumApi.removeThreadVote(thread.id);
        setScore(result.score);
        setUserVote(null);
      } else {
        // Change or add vote
        const result = await forumApi.voteThread(thread.id, vote);
        setScore(result.score);
        setUserVote(vote);
      }
      onVote?.();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const displayName = userProfile?.displayName || userProfile?.email?.split('@')[0] || `User ${thread.authorId.substring(0, 8)}`;
  const preview = thread.content.length > 150 
    ? thread.content.substring(0, 150) + '...' 
    : thread.content;

  return (
    <Link
      to={`/community/thread/${thread.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
      aria-label={`Thread: ${thread.title}`}
    >
      <Card variant="thread" hoverable={false}>
        <div className="forum-thread-card__voting">
          <VotingButtons
            score={score}
            userVote={userVote}
            onVote={handleVote}
            size="md"
            variant="thread"
            disabled={!user}
          />
        </div>

        <div className="forum-thread-card__content">
          <div className="forum-thread-card__header">
            <ThreadBadges 
              isPinned={thread.isPinned} 
              isLocked={thread.isLocked} 
              tags={thread.tags}
              isSolved={thread.isSolved}
            />
          </div>

          <h3 className="forum-thread-card__title">
            {thread.title}
          </h3>

          <p className="forum-thread-card__preview">
            {preview}
          </p>

          <div className="forum-thread-card__meta">
            {userProfile && (
              <>
                <img
                  src={userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
                  alt={displayName}
                  className="forum-thread-card__avatar"
                />
                <Link
                  to={`/profile/${thread.authorId}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'inherit', textDecoration: 'none', fontWeight: 'var(--font-medium)' }}
                >
                  {displayName}
                </Link>
                <span>•</span>
              </>
            )}
            <span>{thread.postCount} {thread.postCount === 1 ? 'reply' : 'replies'}</span>
            <span>•</span>
            <span>{formatTimeAgo(thread.lastPostAt)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

