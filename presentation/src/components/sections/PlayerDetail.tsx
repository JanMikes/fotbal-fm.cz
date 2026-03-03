'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Instagram, Twitter, Facebook } from 'lucide-react';
import type { Player } from '@/lib/types';

interface PlayerDetailProps {
  player: Player;
}

const positionLabels: Record<string, string> = {
  'brankář': 'Brankář',
  'obránce': 'Obránce',
  'záložník': 'Záložník',
  'útočník': 'Útočník',
};

export default function PlayerDetail({ player }: PlayerDetailProps) {
  const isPlayer = player.type === 'hráč';
  const displayPosition = player.position ? positionLabels[player.position] ?? player.position : player.positionText;
  const imageUrl = player.photo?.url || '/players/player-1.jpg';

  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="relative aspect-[3/4] max-h-[600px] overflow-hidden"
          >
            <Image
              src={imageUrl}
              alt={player.name}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-card" />
            {isPlayer && player.number != null && (
              <div className="absolute bottom-6 left-6">
                <span className="text-7xl font-black text-accent number-display leading-none">
                  #{player.number}
                </span>
              </div>
            )}
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col justify-center"
          >
            <h1 className="text-4xl md:text-5xl font-black text-primary uppercase leading-tight mb-4">
              {player.name}
            </h1>

            {displayPosition && (
              <p className="text-xl text-accent font-semibold uppercase tracking-wide mb-8">
                {displayPosition}
              </p>
            )}

            {/* Stats */}
            {isPlayer && (
              <div className="flex gap-8 mb-8 pb-8 border-b border-primary/10">
                {player.number != null && (
                  <div>
                    <p className="text-small text-primary/50 uppercase tracking-wider mb-1">Číslo dresu</p>
                    <p className="text-3xl font-black text-primary number-display">#{player.number}</p>
                  </div>
                )}
                {displayPosition && (
                  <div>
                    <p className="text-small text-primary/50 uppercase tracking-wider mb-1">Pozice</p>
                    <p className="text-lg font-bold text-primary">{displayPosition}</p>
                  </div>
                )}
              </div>
            )}

            {/* Bio */}
            {player.bio && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">O hráči</h2>
                <p className="text-primary/70 leading-relaxed">{player.bio}</p>
              </div>
            )}

            {/* Social Links */}
            {(player.instagram || player.twitter || player.facebook) && (
              <div>
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Sociální sítě</h2>
                <div className="flex gap-3">
                  {player.instagram && (
                    <a
                      href={player.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 bg-surface-light flex items-center justify-center text-primary/60 hover:bg-accent hover:text-white transition-colors"
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {player.twitter && (
                    <a
                      href={player.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 bg-surface-light flex items-center justify-center text-primary/60 hover:bg-accent hover:text-white transition-colors"
                    >
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {player.facebook && (
                    <a
                      href={player.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-12 h-12 bg-surface-light flex items-center justify-center text-primary/60 hover:bg-accent hover:text-white transition-colors"
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
