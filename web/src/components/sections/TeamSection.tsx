'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { PlayerCard } from '../ui';
import type { Player } from '@/lib/types';

interface TeamSectionProps {
  players: Player[];
  categorySlug: string;
}

type TeamTab = 'players' | 'staff';

export default function TeamSection({ players, categorySlug }: TeamSectionProps) {
  const [activeTab, setActiveTab] = useState<TeamTab>('players');

  const hráči = players.filter((p) => p.type === 'hráč');
  const staff = players.filter((p) => p.type === 'realizační tým');

  const goalkeepers = hráči.filter((p) => p.position === 'brankář');
  const defenders = hráči.filter((p) => p.position === 'obránce');
  const midfielders = hráči.filter((p) => p.position === 'záložník');
  const forwards = hráči.filter((p) => p.position === 'útočník');
  const noPosition = hráči.filter((p) => !p.position);

  if (hráči.length === 0 && staff.length === 0) {
    return null;
  }

  const positionGroups = [
    { label: 'Brankáři', players: goalkeepers },
    { label: 'Obránci', players: defenders },
    { label: 'Záložníci', players: midfielders },
    { label: 'Útočníci', players: forwards },
    { label: 'Hráči', players: noPosition },
  ].filter((g) => g.players.length > 0);

  return (
    <section className="relative py-section bg-primary overflow-hidden">

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12"
        >
          <div>
            <h2 className="text-section text-white uppercase mb-4">
              <span className="relative inline-block">
                Tým
                <span className="absolute left-0 bottom-0 w-24 h-1.5 bg-accent transform translate-y-3" />
              </span>
            </h2>
            <p className="text-body-lg text-white/60 max-w-xl">
              Seznamte se s hráči a realizačním týmem.
            </p>
          </div>

          {staff.length > 0 && (
            <div className="flex items-center gap-2 p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('players')}
                className={clsx(
                  'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
                  activeTab === 'players'
                    ? 'bg-accent text-white'
                    : 'text-white/60 hover:text-white'
                )}
              >
                Hráči
              </button>
              <button
                onClick={() => setActiveTab('staff')}
                className={clsx(
                  'px-6 py-2.5 rounded-full text-sm font-semibold uppercase tracking-wide transition-all',
                  activeTab === 'staff'
                    ? 'bg-accent text-white'
                    : 'text-white/60 hover:text-white'
                )}
              >
                Realizační tým
              </button>
            </div>
          )}
        </motion.div>

        {/* Players Tab */}
        {activeTab === 'players' && (
          <div className="space-y-12">
            {positionGroups.map((group) => (
              <div key={group.label}>
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-small text-accent uppercase tracking-wider mb-6"
                >
                  {group.label}
                </motion.h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
                  {group.players.map((player, index) => (
                    <motion.div
                      key={player.documentId}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <PlayerCard player={player} categorySlug={categorySlug} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
              {staff.map((person, index) => (
                <motion.div
                  key={person.documentId}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <PlayerCard player={person} categorySlug={categorySlug} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
