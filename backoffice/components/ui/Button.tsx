import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center cursor-pointer font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none';

  const sizeStyles = {
    sm: 'px-4 py-1.5 text-sm rounded-md',
    md: 'px-6 py-2.5 text-base rounded-lg',
    lg: 'px-8 py-3 text-lg rounded-xl',
  };

  const variantStyles = {
    primary:
      'bg-primary text-white hover:bg-primary-hover focus:ring-ring-focus shadow-md hover:shadow-lg active:scale-95',
    secondary:
      'bg-white text-text-primary hover:bg-surface-hover focus:ring-ring-focus border border-border-light hover:border-border active:scale-95',
    danger:
      'bg-danger text-white hover:bg-danger-hover focus:ring-ring-focus shadow-md hover:shadow-lg active:scale-95',
    accent:
      'bg-accent text-white hover:bg-accent-hover focus:ring-ring-focus shadow-md hover:shadow-lg active:scale-95',
    ghost:
      'bg-transparent text-text-muted hover:text-text-primary hover:bg-surface-hover focus:ring-ring-focus active:scale-95',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
