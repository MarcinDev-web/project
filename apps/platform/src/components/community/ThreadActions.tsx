import { useState } from 'react';
import { forumApi } from '../../api/forum';

export interface ThreadActionsProps {
  threadId: string;
  isFollowed?: boolean;
  isBookmarked?: boolean;
  isSolved?: boolean;
  isAuthor?: boolean;
  onUpdate?: () => void;
}

/**
 * Thread Actions Component
 * 
 * Follow, bookmark, and solved status buttons
 */
export function ThreadActions({ 
  threadId, 
  isFollowed = false, 
  isBookmarked = false, 
  isSolved = false,
  isAuthor = false,
  onUpdate 
}: ThreadActionsProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isMarkingSolved, setIsMarkingSolved] = useState(false);

  const handleFollow = async () => {
    setIsFollowing(true);
    try {
      if (isFollowed) {
        await forumApi.unfollowThread(threadId);
      } else {
        await forumApi.followThread(threadId);
      }
      onUpdate?.();
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setIsFollowing(false);
    }
  };

  const handleBookmark = async () => {
    setIsBookmarking(true);
    try {
      if (isBookmarked) {
        await forumApi.unbookmarkThread(threadId);
      } else {
        await forumApi.bookmarkThread(threadId);
      }
      onUpdate?.();
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    } finally {
      setIsBookmarking(false);
    }
  };

  const handleMarkSolved = async () => {
    if (!isAuthor || isSolved) return;
    setIsMarkingSolved(true);
    try {
      await forumApi.markThreadSolved(threadId);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to mark as solved:', error);
    } finally {
      setIsMarkingSolved(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
      <button
        onClick={handleFollow}
        disabled={isFollowing}
        style={{
          padding: 'var(--spacing-1) var(--spacing-3)',
          background: isFollowed ? 'var(--bg-button-primary)' : 'var(--bg-button)',
          color: isFollowed ? 'white' : 'var(--text-1)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: isFollowing ? 'not-allowed' : 'pointer',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
        }}
      >
        {isFollowed ? '✓ Following' : '+ Follow'}
      </button>
      
      <button
        onClick={handleBookmark}
        disabled={isBookmarking}
        style={{
          padding: 'var(--spacing-1) var(--spacing-3)',
          background: isBookmarked ? 'var(--bg-button-primary)' : 'var(--bg-button)',
          color: isBookmarked ? 'white' : 'var(--text-1)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: isBookmarking ? 'not-allowed' : 'pointer',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
        }}
      >
        {isBookmarked ? '🔖 Saved' : '🔖 Save'}
      </button>

      {isAuthor && !isSolved && (
        <button
          onClick={handleMarkSolved}
          disabled={isMarkingSolved}
          style={{
            padding: 'var(--spacing-1) var(--spacing-3)',
            background: 'var(--color-success)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: isMarkingSolved ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
          }}
        >
          ✓ Mark as Solved
        </button>
      )}
    </div>
  );
}

