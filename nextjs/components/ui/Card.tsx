import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'bordered';
}

export default function Card({
  children,
  className = '',
  variant = 'default'
}: CardProps) {
  const variantStyles = {
    default: 'bg-surface border border-border',
    elevated: 'bg-surface-elevated border border-border-light shadow-xl',
    bordered: 'bg-background border-2 border-border-light',
  };

  return (
    <div className={`rounded-xl p-6 transition-all duration-300 ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}
