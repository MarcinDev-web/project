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

  // Validate children - if it's an object that's not a valid ReactNode, log error and show message
  if (children !== null && children !== undefined && typeof children === 'object' && !Array.isArray(children) && !('$$typeof' in children)) {
    console.error('Card received invalid children (object instead of ReactNode):', children);
    return (
      <div 
        style={style}
        className={classes}
        {...props}
      >
        <div style={{ padding: 'var(--spacing-4)', color: 'var(--color-error)' }}>
          Błąd: Nieprawidłowa zawartość karty
        </div>
      </div>
    );
  }

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

