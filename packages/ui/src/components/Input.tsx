import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'forge';
}

export function Input({ variant = 'default', className = '', ...props }: InputProps) {
  const variantClass = variant === 'forge' ? 'forge-input' : 'input';
  return <input className={`${variantClass} ${className}`.trim()} {...props} />;
}
