import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  variant?: 'default' | 'thread' | 'post' | 'category';
}

export function Card({ 
  children, 
  className = '', 
  hoverable = true, 
  variant = 'default',
  style, 
  ...props 
}: CardProps) {
  const baseClasses = variant === 'default' ? 'forge-card' : `forum-${variant === 'thread' ? 'thread-card' : variant === 'post' ? 'post' : 'category-card'}`;
  const classes = `${baseClasses} ${hoverable && variant === 'default' ? 'forge-card--hoverable' : ''} ${className}`.trim();

  return (
    <div 
      style={style}
      className={classes}
      {...props}
    >
      {children}
    </div>
  );
}

