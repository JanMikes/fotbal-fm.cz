'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import type { NewsArticleType } from '@/lib/types';

interface NewsArticleTypeFilterProps {
  types: NewsArticleType[];
}

export default function NewsArticleTypeFilter({ types }: NewsArticleTypeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeType = searchParams.get('typ');

  if (types.length === 0) return null;

  function navigate(typeSlug: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (typeSlug) {
      params.set('typ', typeSlug);
    } else {
      params.delete('typ');
    }
    params.delete('stranka');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      {types.map((type) => (
        <button
          key={type.slug}
          onClick={() => navigate(type.slug)}
          className={clsx(
            'px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wide transition-all border border-accent',
            activeType === type.slug
              ? 'bg-accent text-white'
              : 'text-accent hover:bg-accent/5'
          )}
        >
          {type.name}
        </button>
      ))}
      {activeType && (
        <button
          onClick={() => navigate(null)}
          className="ml-2 text-sm text-accent hover:text-accent/80 transition-colors"
        >
          Zrušit filtrování
        </button>
      )}
    </div>
  );
}
