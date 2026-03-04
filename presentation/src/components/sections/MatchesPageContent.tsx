'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { MiniCalendar } from '../ui';
import MatchCardWide from '../ui/MatchCardWide';
import type { Match } from '@/lib/types';

type MatchFilter = 'all' | 'upcoming' | 'finished';

interface MatchesPageContentProps {
  matches: Match[];
}

export default function MatchesPageContent({ matches }: MatchesPageContentProps) {
  const [filter, setFilter] = useState<MatchFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => a.rawMatchDate.localeCompare(b.rawMatchDate));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (filter === 'upcoming') return sortedMatches.filter((m) => m.status === 'upcoming');
    if (filter === 'finished') return sortedMatches.filter((m) => m.status === 'finished');
    return sortedMatches;
  }, [sortedMatches, filter]);

  const displayedMatches = useMemo(() => {
    if (!selectedDate) return filteredMatches;
    return filteredMatches.filter((m) => m.rawMatchDate === selectedDate);
  }, [filteredMatches, selectedDate]);

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-surface-light rounded-full shadow-sm mb-8 w-fit ml-auto">
        {([
          { key: 'all', label: 'Všechny' },
          { key: 'upcoming', label: 'Nadcházející' },
          { key: 'finished', label: 'Odehrané' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
              filter === key
                ? 'bg-accent text-white'
                : 'text-primary/60 hover:text-primary'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar column */}
        <div className="lg:col-span-4">
          <MiniCalendar
            matches={matches}
            selectedDate={selectedDate}
            onDaySelect={setSelectedDate}
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="mt-3 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              Zobrazit všechny zápasy
            </button>
          )}
        </div>

        {/* Match cards column */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${filter}-${selectedDate ?? 'all'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {displayedMatches.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {displayedMatches.map((match, index) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <MatchCardWide match={match} />
                    </motion.div>
                  ))}
                </div>
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
        </div>
      </div>
    </div>
  );
}
