'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      children,
      icon,
      iconPosition = 'right',
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = clsx(
      'inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-wide',
      'transition-all duration-300 ease-smooth',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      fullWidth && 'w-full'
    );

    const variants = {
      primary: clsx(
        'bg-accent text-white btn-slide',
        'hover:shadow-button active:scale-[0.98]'
      ),
      secondary: clsx(
        'bg-primary text-white',
        'hover:bg-primary-50 active:scale-[0.98]'
      ),
      outline: clsx(
        'bg-transparent border-2 border-white text-white',
        'hover:bg-white hover:text-primary active:scale-[0.98]'
      ),
      ghost: clsx(
        'bg-transparent text-primary',
        'hover:bg-surface-light active:scale-[0.98]'
      ),
    };

    const sizes = {
      sm: 'px-4 py-2 text-xs rounded-full',
      md: 'px-6 py-3 text-sm rounded-full',
      lg: 'px-8 py-4 text-base rounded-full',
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled}
        {...props}
      >
        {icon && iconPosition === 'left' && (
          <span className="w-5 h-5">{icon}</span>
        )}
        <span>{children}</span>
        {icon && iconPosition === 'right' && (
          <span className="w-5 h-5">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
