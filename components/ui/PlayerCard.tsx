'use client';

import { User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Player } from '@/types';

interface PlayerCardProps {
  player: Player;
}

export default function PlayerCard({ player }: PlayerCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden group"
    >
      {/* Player Photo/Placeholder */}
      <div className="relative h-64 bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
        {player.photo ? (
          <img
            src={player.photo}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-24 h-24 text-white/30" />
        )}

        {/* Number Overlay */}
        <div className="absolute top-4 right-4 w-16 h-16 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
          <span className="text-2xl font-bold text-primary">{player.number}</span>
        </div>
      </div>

      {/* Player Info */}
      <div className="p-5">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{player.name}</h3>
        <p className="text-secondary font-semibold mb-3">{player.position}</p>

        {(player.height || player.weight) && (
          <div className="flex gap-4 text-sm text-gray-600 pt-3 border-t border-gray-100">
            {player.height && (
              <div>
                <span className="text-gray-400">Výška:</span>{' '}
                <span className="font-semibold">{player.height} cm</span>
              </div>
            )}
            {player.weight && (
              <div>
                <span className="text-gray-400">Váha:</span>{' '}
                <span className="font-semibold">{player.weight} kg</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
