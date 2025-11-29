import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  variant?: 'default' | 'forge' | 'gaming' | 'thread' | 'post' | 'category';
}

export function Card({
  children,
  className = '',
  hoverable = true,
  variant = 'default',
  style,
  ...props
}: CardProps) {
  // Determine base class based on variant
  let baseClasses = '';
  if (variant === 'default' || variant === 'forge') {
    baseClasses = 'forge-card';
  } else if (variant === 'gaming') {
    baseClasses = 'card';
  } else {
    // Forum variants
    baseClasses = `forum-${variant === 'thread' ? 'thread-card' : variant === 'post' ? 'post' : 'category-card'}`;
  }

  // Add hoverable class if needed (only for forge-card currently, gaming card has hover built-in or needs logic)
  // .card in cards.css has :hover logic built-in but checked against .card-disabled
  // .forge-card has .forge-card--hoverable

  let hoverClass = '';
  if (hoverable) {
    if (variant === 'default' || variant === 'forge') {
      hoverClass = 'forge-card--hoverable';
    }
    // Gaming card doesn't have a specific hover class, it just hovers.
  }

  const classes = `${baseClasses} ${hoverClass} ${className}`.trim();

  // Validate children - if it's an object that's not a valid ReactNode, log error and show message
  if (
    children !== null &&
    children !== undefined &&
    typeof children === 'object' &&
    !Array.isArray(children) &&
    !('$$typeof' in children)
  ) {
    console.error('Card received invalid children (object instead of ReactNode):', children);
    return (
      <div style={style} className={classes} {...props}>
        <div style={{ padding: 'var(--spacing-4)', color: 'var(--color-error)' }}>
          Error: Invalid card content
        </div>
      </div>
    );
  }

  return (
    <div style={style} className={classes} {...props}>
      {children}
    </div>
  );
}
