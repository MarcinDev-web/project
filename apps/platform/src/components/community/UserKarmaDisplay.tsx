import { useState } from 'react';
import { forumApi } from '../../api/forum';

export interface UserKarmaDisplayProps {
  userId: string;
  karma: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * User Karma Display Component
 * 
 * Displays user reputation/karma with color coding based on level
 */
export function UserKarmaDisplay({ karma, size = 'md' }: Omit<UserKarmaDisplayProps, 'userId'>) {
  const getKarmaLevel = (karma: number): { level: string; color: string } => {
    if (karma >= 1000) return { level: 'Legend', color: 'var(--forum-karma-legend)' };
    if (karma >= 500) return { level: 'Expert', color: 'var(--forum-karma-expert)' };
    if (karma >= 200) return { level: 'High', color: 'var(--forum-karma-high)' };
    if (karma >= 50) return { level: 'Medium', color: 'var(--forum-karma-medium)' };
    return { level: 'Low', color: 'var(--forum-karma-low)' };
  };

  const { level, color } = getKarmaLevel(karma);
  const sizeMap = {
    sm: 'var(--text-xs)',
    md: 'var(--text-sm)',
    lg: 'var(--text-base)',
  };

  return (
    <span style={{ fontSize: sizeMap[size], color, fontWeight: 'var(--font-medium)' }}>
      {karma} {level}
    </span>
  );
}

