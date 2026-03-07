'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import type { NewsArticleType, Category } from '@/lib/types';

interface NewsArticleTypeFilterProps {
  types: NewsArticleType[];
  categories?: Category[];
}

function parseMulti(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}

export default function NewsArticleTypeFilter({ types, categories }: NewsArticleTypeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTypes = parseMulti(searchParams.get('typ'));
  const activeCategories = parseMulti(searchParams.get('kategorie'));

  const hasAnyFilter = activeTypes.length > 0 || activeCategories.length > 0;

  if (types.length === 0 && (!categories || categories.length === 0)) return null;

  function navigate(key: string, values: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length > 0) {
      params.set(key, values.join(','));
    } else {
      params.delete(key);
    }
    params.delete('stranka');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function resetAll() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-8">
      <button
        onClick={resetAll}
        className={clsx(
          'px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wide transition-all border border-accent',
          !hasAnyFilter
            ? 'bg-accent text-white'
            : 'text-accent hover:bg-accent/5'
        )}
      >
        Vše
      </button>

      {types.map((type) => (
        <button
          key={type.slug}
          onClick={() => navigate('typ', toggleValue(activeTypes, type.slug))}
          className={clsx(
            'px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wide transition-all border border-accent',
            activeTypes.includes(type.slug)
              ? 'bg-accent text-white'
              : 'text-accent hover:bg-accent/5'
          )}
        >
          {type.name}
        </button>
      ))}

      {categories && categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => navigate('kategorie', toggleValue(activeCategories, cat.slug))}
          className={clsx(
            'px-5 py-2 rounded-full text-sm font-semibold uppercase tracking-wide transition-all border border-accent',
            activeCategories.includes(cat.slug)
              ? 'bg-accent text-white'
              : 'text-accent hover:bg-accent/5'
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
