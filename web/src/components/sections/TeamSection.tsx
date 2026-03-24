'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { LayoutGrid, List } from 'lucide-react';
import { PlayerCard } from '../ui';
import type { Player } from '@/lib/types';

interface TeamSectionProps {
  players: Player[];
  categorySlug: string;
  categoryName: string;
}

type TeamTab = 'players' | 'staff';
type ViewMode = 'grid' | 'table';

const positionLabels: Record<string, string> = {
  'brankář': 'Brankář',
  'obránce': 'Obránce',
  'záložník': 'Záložník',
  'útočník': 'Útočník',
};

export default function TeamSection({ players, categorySlug, categoryName }: TeamSectionProps) {
  const [activeTab, setActiveTab] = useState<TeamTab>('players');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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

          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 p-1 bg-white/10 rounded-lg backdrop-blur-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={clsx(
                    'p-2 rounded-md transition-all',
                    viewMode === 'grid'
                      ? 'bg-accent text-white'
                      : 'text-white/60 hover:text-white'
                  )}
                  aria-label="Zobrazení mřížka"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={clsx(
                    'p-2 rounded-md transition-all',
                    viewMode === 'table'
                      ? 'bg-accent text-white'
                      : 'text-white/60 hover:text-white'
                  )}
                  aria-label="Zobrazení tabulka"
                >
                  <List className="w-4 h-4" />
                </button>
            </div>

            {/* Tab switcher */}
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
                  Hráči - {categoryName}
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
          </div>
        </motion.div>

        {/* Players Tab - Grid View */}
        {activeTab === 'players' && viewMode === 'grid' && (
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

        {/* Players Tab - Table View */}
        {activeTab === 'players' && viewMode === 'table' && (
          <div className="space-y-8">
            {positionGroups.map((group) => (
              <div key={group.label}>
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-small text-accent uppercase tracking-wider mb-4"
                >
                  {group.label}
                </motion.h3>
                <div className="space-y-1">
                  {group.players.map((player, index) => (
                    <motion.div
                      key={player.documentId}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                    >
                      <Link
                        href={`/kategorie/${categorySlug}/hrac/${player.slug}`}
                        className="flex items-center gap-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                      >
                        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white/10">
                          {player.photo?.url ? (
                            <Image
                              src={player.photo.url}
                              alt={player.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src="/player-placeholder.png"
                              alt={player.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        {player.number != null && (
                          <span className="text-accent font-bold text-sm w-8 text-center shrink-0">
                            #{player.number}
                          </span>
                        )}
                        <span className="text-white font-semibold text-sm group-hover:text-accent transition-colors">
                          {player.name}
                        </span>
                        {player.position && (
                          <span className="text-white/40 text-xs ml-auto hidden sm:block">
                            {positionLabels[player.position] ?? player.position}
                          </span>
                        )}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Staff Tab - Grid View */}
        {activeTab === 'staff' && viewMode === 'grid' && (
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

        {/* Staff Tab - Table View */}
        {activeTab === 'staff' && viewMode === 'table' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-1">
              {staff.map((person, index) => (
                <motion.div
                  key={person.documentId}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <Link
                    href={`/kategorie/${categorySlug}/hrac/${person.slug}`}
                    className="flex items-center gap-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                  >
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 bg-white/10">
                      {person.photo?.url ? (
                        <Image
                          src={person.photo.url}
                          alt={person.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/player-placeholder.png"
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <span className="text-white font-semibold text-sm group-hover:text-accent transition-colors">
                      {person.name}
                    </span>
                    {person.positionText && (
                      <span className="text-white/40 text-xs ml-auto hidden sm:block">
                        {person.positionText}
                      </span>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
