'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { MiniCalendar, FilterSelect } from '../ui';
import MatchCardWide from '../ui/MatchCardWide';
import { formatSeason, matchSeason } from '@/lib/season';
import type { Match } from '@/lib/types';

type MatchFilter = 'all' | 'upcoming' | 'finished';

interface MatchesPageContentProps {
  matches: Match[];
}

export default function MatchesPageContent({ matches }: MatchesPageContentProps) {
  const [filter, setFilter] = useState<MatchFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  // Seasons present in the data, newest first. Default = newest with data.
  const seasons = useMemo(() => {
    const unique = new Set(matches.map(matchSeason));
    return [...unique].sort((a, b) => b - a);
  }, [matches]);

  const activeSeason = selectedSeason !== null && seasons.includes(selectedSeason)
    ? selectedSeason
    : seasons[0] ?? null;

  const seasonMatches = useMemo(() => {
    if (activeSeason === null) return matches;
    return matches.filter((m) => matchSeason(m) === activeSeason);
  }, [matches, activeSeason]);

  const sortedMatches = useMemo(() => {
    return [...seasonMatches].sort((a, b) => a.rawMatchDate.localeCompare(b.rawMatchDate));
  }, [seasonMatches]);

  const filteredMatches = useMemo(() => {
    if (filter === 'upcoming') return sortedMatches.filter((m) => m.status === 'upcoming');
    if (filter === 'finished') return sortedMatches.filter((m) => m.status === 'finished');
    return sortedMatches;
  }, [sortedMatches, filter]);

  const displayedMatches = useMemo(() => {
    if (!selectedDate) return filteredMatches;
    return filteredMatches.filter((m) => m.rawMatchDate === selectedDate);
  }, [filteredMatches, selectedDate]);

  const handleSeasonChange = (value: string) => {
    setSelectedSeason(Number(value));
    setSelectedDate(null);
  };

  return (
    <div>
      {/* Filters: season + status tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
        {seasons.length > 1 && (
          <FilterSelect
            label="Sezóna"
            value={String(activeSeason)}
            options={seasons.map((s) => ({ value: String(s), label: formatSeason(s) }))}
            onChange={handleSeasonChange}
          />
        )}

        <div className="flex items-center gap-1 sm:gap-2 p-1.5 bg-surface-light rounded-full shadow-sm w-full sm:w-fit sm:ml-auto">
          {([
            { key: 'all', label: 'Vše' },
            { key: 'upcoming', label: 'Nadcházející' },
            { key: 'finished', label: 'Odehrané' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={clsx(
                'flex-1 sm:flex-initial px-3 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all whitespace-nowrap',
                filter === key
                  ? 'bg-accent text-white'
                  : 'text-primary/60 hover:text-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar column */}
        <div className="lg:col-span-4">
          <MiniCalendar
            matches={seasonMatches}
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
              key={`${activeSeason}-${filter}-${selectedDate ?? 'all'}`}
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
