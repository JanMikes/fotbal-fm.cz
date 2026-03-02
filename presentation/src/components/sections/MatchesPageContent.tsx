'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { MatchCard, MiniCalendar } from '../ui';
import type { Match } from '@/lib/types';

interface MatchesPageContentProps {
  matches: Match[];
}

export default function MatchesPageContent({ matches }: MatchesPageContentProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => a.rawMatchDate.localeCompare(b.rawMatchDate));
  }, [matches]);

  const displayedMatches = useMemo(() => {
    if (!selectedDate) return sortedMatches;
    return sortedMatches.filter((m) => m.rawMatchDate === selectedDate);
  }, [sortedMatches, selectedDate]);

  return (
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
            key={selectedDate ?? 'all'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {displayedMatches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayedMatches.map((match, index) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <MatchCard match={match} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Calendar className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                <p className="text-primary/60">
                  Žádné zápasy v tento den
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
