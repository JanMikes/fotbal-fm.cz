import Image from 'next/image';
import { Mail, Phone } from 'lucide-react';
import type { ComponentContactCards } from '@/lib/types';

interface ContactCardsProps {
  data: ComponentContactCards;
  sidebar?: boolean;
}

export function ContactCards({ data, sidebar }: ContactCardsProps) {
  if (!data.cards || data.cards.length === 0) return null;

  return (
    <div className={sidebar ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'}>
      {data.cards.map((card, i) =>
        card.style === 'style-2' ? (
          <div key={i} className="bg-white shadow-card text-center">
            <div className="relative h-48 overflow-hidden">
              {card.photo && (
                <Image
                  src={card.photo.url}
                  alt={card.name}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="relative -mt-5 z-10 mx-5">
              <div
                className="bg-accent py-1 px-4"
                style={{ clipPath: 'polygon(0% 0%, 100% 0%, 96% 100%, 4% 100%)' }}
              >
                <h4 className="font-bold text-white text-lg">{card.name}</h4>
              </div>
            </div>
            <div className="px-4 pt-2 pb-4">
              {card.role && (
                <p className="text-sm text-primary/60 mb-3">{card.role}</p>
              )}
              <div className="space-y-1">
                {card.phone && (
                  <a
                    href={`tel:${card.phone}`}
                    className="flex items-center justify-center gap-2 text-sm text-primary/70 hover:text-accent transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {card.phone}
                  </a>
                )}
                {card.email && (
                  <a
                    href={`mailto:${card.email}`}
                    className="flex items-center justify-center gap-2 text-sm text-primary/70 hover:text-accent transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {card.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div key={i} className="bg-white rounded-lg shadow-card p-6 text-center">
            {card.photo && (
              <div className="relative w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden">
                <Image
                  src={card.photo.url}
                  alt={card.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <h4 className="font-bold text-primary">{card.name}</h4>
            {card.role && (
              <p className="text-sm text-primary/60 mb-3">{card.role}</p>
            )}
            <div className="space-y-1">
              {card.phone && (
                <a
                  href={`tel:${card.phone}`}
                  className="flex items-center justify-center gap-2 text-sm text-primary/70 hover:text-accent transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {card.phone}
                </a>
              )}
              {card.email && (
                <a
                  href={`mailto:${card.email}`}
                  className="flex items-center justify-center gap-2 text-sm text-primary/70 hover:text-accent transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {card.email}
                </a>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
