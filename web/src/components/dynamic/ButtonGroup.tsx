import Link from 'next/link';
import { clsx } from 'clsx';
import type { ComponentButtonGroup } from '@/lib/types';

interface ButtonGroupProps {
  data: ComponentButtonGroup;
}

const alignClasses: Record<string, string> = {
  L: 'justify-start',
  C: 'justify-center',
  R: 'justify-end',
};

const variantClasses: Record<string, string> = {
  Primary: 'bg-accent text-white hover:bg-accent/90',
  Secondary: 'bg-primary text-white hover:bg-primary/90',
  Outline: 'border-2 border-accent text-accent hover:bg-accent hover:text-white',
  Ghost: 'text-accent hover:bg-accent/10',
};

const sizeClasses: Record<string, string> = {
  S: 'px-4 py-1.5 text-sm',
  M: 'px-6 py-2.5 text-sm',
  L: 'px-8 py-3 text-base',
};

export function ButtonGroup({ data }: ButtonGroupProps) {
  if (!data.buttons || data.buttons.length === 0) return null;

  return (
    <div className={clsx('flex flex-wrap gap-3', alignClasses[data.alignment] || alignClasses.L)}>
      {data.buttons.map((btn, i) => {
        if (!btn.link) return null;
        return (
          <Link
            key={i}
            href={btn.link.href}
            className={clsx(
              'inline-flex items-center font-medium rounded transition-colors',
              variantClasses[btn.variant] || variantClasses.Primary,
              sizeClasses[btn.size] || sizeClasses.M
            )}
            {...(btn.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {btn.link.text || 'Odkaz'}
          </Link>
        );
      })}
    </div>
  );
}
