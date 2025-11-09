import { useState } from 'react';
import type { ReactNode } from 'react';

export interface VotingButtonsProps {
  score: number;
  userVote: 'up' | 'down' | null;
  onVote: (vote: 'up' | 'down') => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'thread' | 'post';
  disabled?: boolean;
  className?: string;
}

/**
 * Reddit-style voting buttons component
 * 
 * Vertical layout with upvote/downvote buttons and score display
 */
export function VotingButtons({
  score,
  userVote,
  onVote,
  size = 'md',
  variant = 'thread',
  disabled = false,
  className = '',
}: VotingButtonsProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (vote: 'up' | 'down') => {
    if (disabled || isVoting) return;
    
    setIsVoting(true);
    try {
      await onVote(vote);
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const scoreClass = score > 0 
    ? 'forum-voting__score--positive' 
    : score < 0 
    ? 'forum-voting__score--negative' 
    : '';

  return (
    <div className={`forum-voting forum-voting--size-${size} ${className}`}>
      <button
        type="button"
        className={`forum-voting__button forum-voting__button--upvote ${
          userVote === 'up' ? 'active' : ''
        }`}
        onClick={() => handleVote('up')}
        disabled={disabled || isVoting}
        aria-label="Upvote"
        aria-pressed={userVote === 'up'}
      >
        ▲
      </button>
      
      <div className={`forum-voting__score ${scoreClass}`}>
        {score}
      </div>
      
      <button
        type="button"
        className={`forum-voting__button forum-voting__button--downvote ${
          userVote === 'down' ? 'active' : ''
        }`}
        onClick={() => handleVote('down')}
        disabled={disabled || isVoting}
        aria-label="Downvote"
        aria-pressed={userVote === 'down'}
      >
        ▼
      </button>
    </div>
  );
}

