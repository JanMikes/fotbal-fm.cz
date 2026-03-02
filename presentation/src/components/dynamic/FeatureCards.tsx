import Link from 'next/link';
import { clsx } from 'clsx';
import type { ComponentFeatureCards } from '@/lib/types';

interface FeatureCardsProps {
  data: ComponentFeatureCards;
}

const colClasses: Record<string, string> = {
  '2': 'grid-cols-1 sm:grid-cols-2',
  '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function FeatureCards({ data }: FeatureCardsProps) {
  if (!data.cards || data.cards.length === 0) return null;

  return (
    <div className={clsx('grid gap-6', colClasses[data.columns] || colClasses['3'])}>
      {data.cards.map((card, i) => {
        const content = (
          <div className={clsx(
            'bg-white p-6 shadow-card rounded-lg h-full',
            data.card_clickable && card.link && 'card-lift cursor-pointer'
          )}>
            {card.title && (
              <h3 className="font-bold text-primary text-lg mb-2">{card.title}</h3>
            )}
            {card.description && (
              <p className="text-primary/70 text-sm">{card.description}</p>
            )}
            {card.link && !data.card_clickable && (
              <Link
                href={card.link.href}
                className="inline-block mt-4 text-accent text-sm font-medium hover:underline"
                {...(card.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {card.link.text || 'Více'}
              </Link>
            )}
          </div>
        );

        if (data.card_clickable && card.link) {
          return (
            <Link
              key={i}
              href={card.link.href}
              {...(card.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="block"
            >
              {content}
            </Link>
          );
        }

        return <div key={i}>{content}</div>;
      })}
    </div>
  );
}
