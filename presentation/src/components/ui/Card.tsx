'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'dark' | 'glass';
}

export default function Card({
  children,
  className,
  hover = true,
  padding = 'md',
  variant = 'default',
}: CardProps) {
  const variants = {
    default: 'bg-white shadow-card',
    dark: 'bg-primary text-white',
    glass: 'glass',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx(
        'overflow-hidden',
        variants[variant],
        paddings[padding],
        hover && 'card-lift',
        className
      )}
    >
      {children}
    </div>
  );
}
