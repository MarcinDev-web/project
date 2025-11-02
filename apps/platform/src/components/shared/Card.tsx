import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function Card({ children, className = '', hoverable = true, style, ...props }: CardProps) {
  const baseStyle: React.CSSProperties = {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-6)',
    boxShadow: 'var(--shadow-md)',
    transition: 'all var(--transition-base)',
    ...style,
  };

  const hoverStyle: React.CSSProperties = hoverable ? {
    cursor: 'pointer',
  } : {};

  return (
    <div 
      style={{ ...baseStyle, ...hoverStyle }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}

