'use client';

import Image from 'next/image';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { Player } from '@/lib/types';

interface PlayerCardProps {
  player: Player;
  categorySlug: string;
  className?: string;
}

const positionLabels: Record<string, string> = {
  'brankář': 'Brankář',
  'obránce': 'Obránce',
  'záložník': 'Záložník',
  'útočník': 'Útočník',
};

export default function PlayerCard({ player, categorySlug, className }: PlayerCardProps) {
  const href = `/kategorie/${categorySlug}/hrac/${player.slug}`;
  const imageUrl = player.photo?.url || '/players/player-1.jpg';
  const isPlayer = player.type === 'hráč';
  const displayPosition = player.position ? positionLabels[player.position] ?? player.position : player.positionText;

  return (
    <Link href={href} className="block">
      <div
        className={clsx(
          'group relative aspect-player-card overflow-hidden cursor-pointer',
          'card-lift',
          className
        )}
      >
        <Image
          src={imageUrl}
          alt={player.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-card" />
        <div className="absolute inset-0 p-5 flex flex-col justify-end">
          {isPlayer && player.number != null && (
            <span className="text-5xl font-black text-accent number-display mb-1 leading-none">
              #{player.number}
            </span>
          )}
          <h3 className="text-xl font-bold text-white leading-tight">
            {player.name}
          </h3>
          {displayPosition && (
            <p className="text-small text-white/70 mt-1">
              {displayPosition}
            </p>
          )}
          <div className="mt-3 flex gap-2 opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            {player.instagram && (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  window.open(player.instagram!, '_blank');
                }}
                className="w-8 h-8 bg-white/20 flex items-center justify-center hover:bg-accent transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </span>
            )}
            {player.twitter && (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  window.open(player.twitter!, '_blank');
                }}
                className="w-8 h-8 bg-white/20 flex items-center justify-center hover:bg-accent transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
