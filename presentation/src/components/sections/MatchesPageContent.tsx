'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Calendar } from 'lucide-react';
import { MatchCard } from '../ui';
import type { Match } from '@/lib/types';

type Tab = 'upcoming' | 'finished';

interface MatchesPageContentProps {
  upcomingMatches: Match[];
  finishedMatches: Match[];
  defaultTab: Tab;
}

export default function MatchesPageContent({ upcomingMatches, finishedMatches, defaultTab }: MatchesPageContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const matches = activeTab === 'upcoming' ? upcomingMatches : finishedMatches;

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    window.history.replaceState(null, '', `?tab=${tab}`);
  }

  return (
    <>
      {/* Tab Toggle */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-full shadow-sm w-fit mb-10">
        <button
          onClick={() => handleTabChange('upcoming')}
          className={clsx(
            'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
            activeTab === 'upcoming'
              ? 'bg-primary text-white'
              : 'text-primary/60 hover:text-primary'
          )}
        >
          Nadcházející
        </button>
        <button
          onClick={() => handleTabChange('finished')}
          className={clsx(
            'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
            activeTab === 'finished'
              ? 'bg-primary text-white'
              : 'text-primary/60 hover:text-primary'
          )}
        >
          Odehrané
        </button>
      </div>

      {/* Match Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {matches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match, index) => (
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
                {activeTab === 'upcoming'
                  ? 'Žádné nadcházející zápasy'
                  : 'Žádné odehrané zápasy'}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
