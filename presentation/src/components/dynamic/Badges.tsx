import { clsx } from 'clsx';
import type { ComponentBadges } from '@/lib/types';

interface BadgesProps {
  data: ComponentBadges;
}

const alignClasses: Record<string, string> = {
  L: 'justify-start',
  C: 'justify-center',
  R: 'justify-end',
};

const variantClasses: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

const sizeClasses: Record<string, string> = {
  S: 'px-2 py-0.5 text-xs',
  M: 'px-3 py-1 text-sm',
  L: 'px-4 py-1.5 text-base',
};

export function Badges({ data }: BadgesProps) {
  if (!data.badges || data.badges.length === 0) return null;

  return (
    <div className={clsx('flex flex-wrap gap-2', alignClasses[data.alignment] || alignClasses.L)}>
      {data.badges.map((badge, i) => (
        <span
          key={i}
          className={clsx(
            'inline-block font-medium rounded-full',
            variantClasses[badge.variant] || variantClasses.default,
            sizeClasses[badge.size] || sizeClasses.M
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
