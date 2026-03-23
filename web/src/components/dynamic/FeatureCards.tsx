import Link from 'next/link';
import Image from 'next/image';
import { clsx } from 'clsx';
import type { ComponentFeatureCards } from '@/lib/types';

interface FeatureCardsProps {
  data: ComponentFeatureCards;
  sidebar?: boolean;
}

const colClasses: Record<string, string> = {
  '2': 'grid-cols-1 sm:grid-cols-2',
  '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function FeatureCards({ data, sidebar }: FeatureCardsProps) {
  if (!data.cards || data.cards.length === 0) return null;

  return (
    <div className={clsx('grid gap-6', sidebar ? 'grid-cols-1' : (colClasses[data.columns] || colClasses['3']))}>
      {data.cards.map((card, i) => {
        const content = (
          <div className={clsx(
            'bg-white p-6 shadow-card rounded-lg h-full flex gap-4',
            card.link && 'card-lift cursor-pointer'
          )}>
            {card.icon_type === 'image' && card.icon ? (
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={card.icon.url}
                  alt={card.title ?? ''}
                  width={40}
                  height={40}
                  className="w-10 h-10 object-cover"
                />
              </div>
            ) : card.icon_type === 'text' && card.icon_text ? (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {card.icon_text}
              </div>
            ) : card.icon_type === 'initials' && card.title ? (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {getInitials(card.title)}
              </div>
            ) : null}
            <div className="min-w-0">
              {card.title && (
                <h3 className="font-bold text-primary text-lg mb-1">{card.title}</h3>
              )}
              {card.description && (
                <p className="text-primary/70 text-sm">{card.description}</p>
              )}
              {card.link && !data.card_clickable && (
                <span className="inline-block mt-3 text-accent text-sm font-medium hover:underline">
                  {card.link.text || 'Více'} &rarr;
                </span>
              )}
            </div>
          </div>
        );

        if (card.link) {
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
