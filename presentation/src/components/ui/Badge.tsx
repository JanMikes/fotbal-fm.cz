'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'default' | 'accent' | 'live' | 'dark';
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
  pulse?: boolean;
}

export default function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className,
  pulse = false,
}: BadgeProps) {
  const variants = {
    default: 'bg-surface-light text-primary',
    accent: 'bg-accent text-white',
    live: 'bg-red-500 text-white',
    dark: 'bg-primary text-white',
  };

  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
