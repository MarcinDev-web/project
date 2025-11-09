import type { ReactNode } from 'react';

export interface UserBadgeProps {
  type: 'admin' | 'moderator' | 'contributor' | 'verified' | 'op';
  className?: string;
}

/**
 * User Badge Component
 * 
 * Displays user role/status badges
 */
export function UserBadge({ type, className = '' }: UserBadgeProps) {
  const badges = {
    admin: { label: 'Admin', emoji: '🛡️' },
    moderator: { label: 'Mod', emoji: '🔧' },
    contributor: { label: 'Contributor', emoji: '⭐' },
    verified: { label: 'Verified', emoji: '✓' },
    op: { label: 'OP', emoji: '' },
  };

  const badge = badges[type];

  return (
    <span className={`forum-user-badge forum-user-badge--${type} ${className}`}>
      {badge.emoji && <span>{badge.emoji}</span>}
      {badge.label}
    </span>
  );
}

