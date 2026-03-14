'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { MatchCard, MiniCalendar } from '../ui';
import SectionHeader from '../ui/SectionHeader';
import type { Match } from '@/lib/types';

type MatchFilter = 'upcoming' | 'finished';

interface MatchesProps {
  upcomingMatches: Match[];
  finishedMatches: Match[];
  allMatches: Match[];
  categorySlug: string;
}

export default function Matches({ upcomingMatches, finishedMatches, allMatches, categorySlug }: MatchesProps) {
  const [filter, setFilter] = useState<MatchFilter>('upcoming');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const displayedMatches = filter === 'upcoming' ? upcomingMatches : finishedMatches;

  const selectedDayMatches = useMemo(() => {
    if (!selectedDate) return [];
    return allMatches.filter((m) => m.rawMatchDate === selectedDate);
  }, [allMatches, selectedDate]);

  return (
    <section className="py-section pb-4 lg:pb-section bg-surface-light">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <SectionHeader
            title="Kdy hrajeme"
            icon={Calendar}
          />

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-white rounded-full shadow-sm mb-12">
            <button
              onClick={() => setFilter('upcoming')}
              className={clsx(
                'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
                filter === 'upcoming'
                  ? 'bg-accent text-white'
                  : 'text-primary/60 hover:text-primary'
              )}
            >
              Nadcházející
            </button>
            <button
              onClick={() => setFilter('finished')}
              className={clsx(
                'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
                filter === 'finished'
                  ? 'bg-accent text-white'
                  : 'text-primary/60 hover:text-primary'
              )}
            >
              Odehrané
            </button>
          </div>
        </div>

        {/* Desktop: 2 columns (calendar + cards), Mobile: stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* Calendar column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-4"
          >
            <MiniCalendar
              matches={allMatches}
              selectedDate={selectedDate}
              onDaySelect={setSelectedDate}
            />

            {/* Selected day detail */}
            {selectedDate && selectedDayMatches.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-medium text-primary/40 uppercase tracking-wide">
                  Zápasy dne
                </p>
                {selectedDayMatches.map((match) => (
                  <div
                    key={match.id}
                    className="bg-white p-3 shadow-sm border border-surface-light"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-primary truncate">
                        {match.homeTeam}
                      </span>
                      {match.status === 'finished' ? (
                        <span className="font-bold text-primary mx-2 shrink-0">
                          {match.homeScore} : {match.awayScore}
                        </span>
                      ) : (
                        <span className="text-primary/30 mx-2 shrink-0">{match.matchTime}</span>
                      )}
                      <span className="font-medium text-primary truncate text-right">
                        {match.awayTeam}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDate && selectedDayMatches.length === 0 && (
              <div className="mt-4 bg-white p-4 shadow-sm border border-surface-light text-center">
                <p className="text-sm text-primary/40">Žádné zápasy v tento den</p>
              </div>
            )}
          </motion.div>

          {/* Match cards column */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayedMatches.length > 0 ? (
                displayedMatches.map((match, index) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <MatchCard match={match} />
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full text-center py-12"
                >
                  <Calendar className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                  <p className="text-primary/60">
                    {filter === 'upcoming'
                      ? 'Žádné nadcházející zápasy'
                      : 'Žádné odehrané zápasy'}
                  </p>
                </motion.div>
              )}

              {/* Link to all matches - positioned as 4th grid item */}
              <div className="flex items-center justify-center">
                <Link
                  href={`/kategorie/${categorySlug}/zapasy`}
                  className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition-colors text-sm font-bold uppercase tracking-wide"
                >
                  <Calendar className="w-5 h-5" />
                  <span className="border-b-2 border-accent pb-0.5">Všechny zápasy</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
