import Link from 'next/link';
import type { ComponentBannerCards } from '@/lib/types';

interface BannerCardsProps {
  data: ComponentBannerCards;
}

export function BannerCards({ data }: BannerCardsProps) {
  if (!data.cards || data.cards.length === 0) return null;

  return (
    <div className="space-y-4">
      {data.cards.map((card, i) => (
        <div key={i} className="bg-primary text-white p-6 lg:p-8 rounded-lg">
          {card.title && (
            <h3 className="text-xl lg:text-2xl font-bold mb-2">{card.title}</h3>
          )}
          {card.description && (
            <p className="text-white/80">{card.description}</p>
          )}
          {card.link && (
            <Link
              href={card.link.href}
              className="inline-block mt-4 text-accent font-medium hover:underline"
              {...(card.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {card.link.text || 'Více'}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
