import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  children: ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'medium',
  children, 
  className = '', 
  style: customStyle,
  ...props 
}: ButtonProps) {
  const variantStyles = {
    primary: {
      background: 'var(--bg-button-primary)',
      color: 'white',
      border: '1px solid transparent',
    },
    secondary: {
      background: 'var(--bg-button)',
      color: 'var(--text-1)',
      border: '1px solid var(--border-default)',
    },
    danger: {
      background: 'var(--color-error)',
      color: 'white',
      border: '1px solid transparent',
    },
  };

  const sizeStyles = {
    small: {
      padding: 'var(--spacing-1) var(--spacing-3)',
      fontSize: 'var(--text-sm)',
    },
    medium: {
      padding: 'var(--spacing-2) var(--spacing-4)',
      fontSize: 'var(--text-base)',
    },
    large: {
      padding: 'var(--spacing-3) var(--spacing-6)',
      fontSize: 'var(--text-lg)',
    },
  };

  const style: React.CSSProperties = {
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 'var(--font-medium)',
    transition: 'all var(--transition-base)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-2)',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...customStyle,
  };

  return (
    <button 
      style={style}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

