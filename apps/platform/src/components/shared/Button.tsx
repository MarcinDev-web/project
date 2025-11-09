import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'forge';
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
  // Use CSS classes for Forge World styling
  const variantClass = variant === 'forge' ? 'btn-forge primary' : 
                       variant === 'primary' ? 'btn-forge primary' :
                       variant === 'secondary' ? 'btn' :
                       variant === 'danger' ? 'btn-danger' : 'btn';
  
  const sizeClass = size === 'small' ? 'btn-sm' :
                    size === 'large' ? 'btn-lg' : '';

  const classes = `${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <button 
      style={customStyle}
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
}

