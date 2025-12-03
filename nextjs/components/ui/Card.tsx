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
    default: 'bg-surface border border-border shadow-sm',
    elevated: 'bg-surface border border-border shadow-md',
    bordered: 'bg-surface border-2 border-border-light',
  };

  return (
    <div className={`rounded-xl p-6 transition-all duration-300 ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}
