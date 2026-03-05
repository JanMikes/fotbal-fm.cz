'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import type { NewsArticleType, Category } from '@/lib/types';

interface NewsArticleTypeFilterProps {
  types: NewsArticleType[];
  categories?: Category[];
}

export default function NewsArticleTypeFilter({ types, categories }: NewsArticleTypeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeType = searchParams.get('typ');
  const activeCategory = searchParams.get('kategorie');

  if (types.length === 0 && (!categories || categories.length === 0)) return null;

  function navigate(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('stranka');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      {types.length > 0 && (
        <>
          <button
            onClick={() => navigate('typ', null)}
            className={clsx(
              'px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wide transition-all border border-accent',
              !activeType
                ? 'bg-accent text-white'
                : 'text-accent hover:bg-accent/5'
            )}
          >
            Vše
          </button>
          {types.map((type) => (
            <button
              key={type.slug}
              onClick={() => navigate('typ', type.slug)}
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
        </>
      )}

      {categories && categories.length > 0 && (
        <>
          {types.length > 0 && (
            <span className="w-px h-6 bg-primary/20 mx-1" />
          )}
          <button
            onClick={() => navigate('kategorie', null)}
            className={clsx(
              'px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wide transition-all border border-primary/30',
              !activeCategory
                ? 'bg-primary text-white'
                : 'text-primary hover:bg-primary/5'
            )}
          >
            Vše
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => navigate('kategorie', cat.slug)}
              className={clsx(
                'px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wide transition-all border border-primary/30',
                activeCategory === cat.slug
                  ? 'bg-primary text-white'
                  : 'text-primary hover:bg-primary/5'
              )}
            >
              {cat.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
