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
    <div className="flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm shadow-sm p-1">
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={`/kategorie/${cat.slug}`}
          className={clsx(
            'px-4 py-1.5 text-sm font-semibold rounded-full transition-colors whitespace-nowrap',
            activeCategorySlug === cat.slug
              ? 'bg-primary text-white'
              : 'text-primary/70 hover:text-primary hover:bg-surface-light'
          )}
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
