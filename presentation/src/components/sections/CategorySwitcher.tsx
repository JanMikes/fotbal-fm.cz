'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import type { Category } from '@/lib/types';

interface CategorySwitcherProps {
  categories: Category[];
}

export default function CategorySwitcher({ categories }: CategorySwitcherProps) {
  const pathname = usePathname();
  const activeCategorySlug = pathname.match(/^\/kategorie\/([^/]+)/)?.[1] ?? '';

  if (categories.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 rounded-full bg-primary-200/60 backdrop-blur-sm border border-accent/40 p-1">
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={`/kategorie/${cat.slug}`}
          className={clsx(
            'px-4 py-1.5 text-sm font-semibold rounded-full transition-colors whitespace-nowrap',
            activeCategorySlug === cat.slug
              ? 'bg-accent text-white'
              : 'text-accent-light/80 hover:text-white hover:bg-white/10'
          )}
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
