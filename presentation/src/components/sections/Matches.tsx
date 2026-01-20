'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ArrowRight, Calendar } from 'lucide-react';
import { MatchCard } from '../ui';
import Button from '../ui/Button';
import { matches } from '@/data/mockData';

type MatchFilter = 'upcoming' | 'finished';

export default function Matches() {
  const [filter, setFilter] = useState<MatchFilter>('upcoming');

  const upcomingMatches = matches.filter((m) => m.status === 'upcoming' || m.status === 'live');
  const finishedMatches = matches.filter((m) => m.status === 'finished');

  const displayedMatches = filter === 'upcoming' ? upcomingMatches : finishedMatches;

  return (
    <section className="py-section bg-surface-light">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12"
        >
          <div>
            <h2 className="text-section text-primary uppercase accent-underline mb-4">
              Zápasy
            </h2>
            <p className="text-body-lg text-primary/60 max-w-xl">
              Sledujte nadcházející utkání a výsledky našeho týmu v aktuální sezóně.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-white rounded-full shadow-sm">
            <button
              onClick={() => setFilter('upcoming')}
              className={clsx(
                'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
                filter === 'upcoming'
                  ? 'bg-primary text-white'
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
                  ? 'bg-primary text-white'
                  : 'text-primary/60 hover:text-primary'
              )}
            >
              Odehrané
            </button>
          </div>
        </motion.div>

        {/* Match Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <Button
            variant="ghost"
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Zobrazit kalendář
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
