'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { FilterSelect } from '../ui';
import MatchCardWide from '../ui/MatchCardWide';
import { formatSeason } from '@/lib/season';
import type { Match } from '@/lib/types';

export type HomeAwayFilter = 'vse' | 'domaci' | 'venkovni';

interface KdyHrajemeContentProps {
  categories: { slug: string; name: string }[];
  seasons: number[];
  activeCategory: string | null;
  activeHomeAway: HomeAwayFilter;
  activeSeason: number | null;
  matches: Match[];
  page: number;
  pageCount: number;
  total: number;
}

export default function KdyHrajemeContent({
  categories,
  seasons,
  activeCategory,
  activeHomeAway,
  activeSeason,
  matches,
  page,
  pageCount,
  total,
}: KdyHrajemeContentProps) {
  const router = useRouter();

  const navigate = (updates: Record<string, string | null>) => {
    const state: Record<string, string | null> = {
      kategorie: activeCategory,
      zapasy: activeHomeAway === 'vse' ? null : activeHomeAway,
      rocnik: activeSeason !== null ? String(activeSeason) : null,
      strana: null, // filter changes reset pagination; strana is set explicitly
      ...updates,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    router.push(`/kdy-hrajeme${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return (
    <div>
      {/* Filters: category + home/away + season */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-8">
        <FilterSelect
          label="Kategorie"
          value={activeCategory ?? ''}
          options={[
            { value: '', label: 'Všechny kategorie' },
            ...categories.map((c) => ({ value: c.slug, label: c.name })),
          ]}
          onChange={(value) => navigate({ kategorie: value || null })}
        />

        <FilterSelect
          label="Ročník"
          value={activeSeason !== null ? String(activeSeason) : ''}
          options={seasons.map((s) => ({ value: String(s), label: formatSeason(s) }))}
          onChange={(value) => navigate({ rocnik: value })}
        />

        <div className="flex items-center gap-1 sm:gap-2 p-1.5 bg-surface-light rounded-full shadow-sm w-full sm:w-fit sm:ml-auto">
          {([
            { key: 'vse', label: 'Všechny' },
            { key: 'domaci', label: 'Domácí' },
            { key: 'venkovni', label: 'Venkovní' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => navigate({ zapasy: key === 'vse' ? null : key })}
              className={clsx(
                'flex-1 sm:flex-initial px-3 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all whitespace-nowrap',
                activeHomeAway === key
                  ? 'bg-accent text-white'
                  : 'text-primary/60 hover:text-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Match list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeCategory}-${activeHomeAway}-${activeSeason}-${page}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {matches.length > 0 ? (
            <>
              <p className="text-sm text-primary/50 mb-4">
                {total} {total === 1 ? 'zápas' : total < 5 ? 'zápasy' : 'zápasů'}
              </p>
              <div className="grid grid-cols-1 gap-4">
                {matches.map((match, index) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.03 }}
                  >
                    <MatchCardWide match={match} />
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 text-primary/20 mx-auto mb-4" />
              <p className="text-primary/60">
                Žádné zápasy
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => navigate({ strana: p === 1 ? null : String(p) })}
              className={clsx(
                'min-w-10 h-10 px-3 rounded-full text-sm font-semibold transition-all',
                p === page
                  ? 'bg-accent text-white'
                  : 'bg-surface-light text-primary/60 hover:text-primary'
              )}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
