import Image from 'next/image';
import { Mail, Phone } from 'lucide-react';
import type { ComponentContactCards } from '@/lib/types';

interface ContactCardsProps {
  data: ComponentContactCards;
}

export function ContactCards({ data }: ContactCardsProps) {
  if (!data.cards || data.cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.cards.map((card, i) => (
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
      ))}
    </div>
  );
}
