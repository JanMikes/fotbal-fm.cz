import Link from 'next/link';
import { clsx } from 'clsx';
import { ExternalLink } from 'lucide-react';
import type { ComponentLinksList } from '@/lib/types';

interface LinksListProps {
  data: ComponentLinksList;
}

export function LinksList({ data }: LinksListProps) {
  if (!data.links || data.links.length === 0) return null;

  const isGrid = data.layout === 'Grid';

  return (
    <ul className={clsx(
      isGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-2'
    )}>
      {data.links.map((link, i) => (
        <li key={i}>
          <Link
            href={link.disabled ? '#' : link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={clsx(
              'inline-flex items-center gap-1.5 text-accent hover:underline transition-colors',
              link.disabled && 'opacity-50 pointer-events-none'
            )}
          >
            {link.text}
            {link.external && <ExternalLink className="w-3.5 h-3.5" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
