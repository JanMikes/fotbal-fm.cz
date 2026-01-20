'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ArrowRight } from 'lucide-react';
import { PlayerCard } from '../ui';
import Button from '../ui/Button';
import { players, staff } from '@/data/mockData';

type TeamTab = 'players' | 'staff';

export default function Team() {
  const [activeTab, setActiveTab] = useState<TeamTab>('players');

  // Group players by position
  const goalkeepers = players.filter((p) => p.position === 'Brankář');
  const defenders = players.filter((p) => p.position === 'Obránce');
  const midfielders = players.filter((p) => p.position === 'Záložník');
  const forwards = players.filter((p) => p.position === 'Útočník');

  return (
    <section className="relative py-section bg-primary overflow-hidden">
      {/* Diagonal Accent Stripe */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-white/5 transform skew-x-12 translate-x-1/4" />

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
              Seznamte se s hráči a realizačním týmem FK Frýdek-Místek.
            </p>
          </div>

          {/* Tab Buttons */}
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
        </motion.div>

        {/* Players Tab */}
        {activeTab === 'players' && (
          <div className="space-y-12">
            {/* Goalkeepers */}
            {goalkeepers.length > 0 && (
              <div>
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-small text-accent uppercase tracking-wider mb-6"
                >
                  Brankáři
                </motion.h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
                  {goalkeepers.map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <PlayerCard person={player} type="player" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Defenders */}
            {defenders.length > 0 && (
              <div>
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-small text-accent uppercase tracking-wider mb-6"
                >
                  Obránci
                </motion.h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
                  {defenders.map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <PlayerCard person={player} type="player" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Midfielders */}
            {midfielders.length > 0 && (
              <div>
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-small text-accent uppercase tracking-wider mb-6"
                >
                  Záložníci
                </motion.h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
                  {midfielders.map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <PlayerCard person={player} type="player" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Forwards */}
            {forwards.length > 0 && (
              <div>
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="text-small text-accent uppercase tracking-wider mb-6"
                >
                  Útočníci
                </motion.h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6">
                  {forwards.map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <PlayerCard person={player} type="player" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
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
                  key={person.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <PlayerCard person={person} type="staff" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mt-12"
        >
          <Button
            variant="outline"
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Celá sestava
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
