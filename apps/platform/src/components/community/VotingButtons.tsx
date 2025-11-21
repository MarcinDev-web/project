import styles from './VotingButtons.module.css';
import { useState } from 'react';

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
    ? styles.scorePositive
    : score < 0 
    ? styles.scoreNegative
    : '';

  return (
    <div className={`${styles.voting} ${className}`}>
      <button
        type="button"
        className={`${styles.button} ${styles.upvote} ${
          userVote === 'up' ? styles.active : ''
        }`}
        onClick={() => handleVote('up')}
        disabled={disabled || isVoting}
        aria-label="Upvote"
        aria-pressed={userVote === 'up'}
      >
        ▲
      </button>
      
      <div className={`${styles.score} ${scoreClass}`}>
        {score}
      </div>
      
      <button
        type="button"
        className={`${styles.button} ${styles.downvote} ${
          userVote === 'down' ? styles.active : ''
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

