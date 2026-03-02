import Image from 'next/image';
import { clsx } from 'clsx';
import type { ComponentPartnerLogos } from '@/lib/types';

interface PartnerLogosProps {
  data: ComponentPartnerLogos;
}

const colClasses: Record<string, string> = {
  '2': 'grid-cols-2',
  '3': 'grid-cols-2 sm:grid-cols-3',
  '4': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  '5': 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  '6': 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
};

export function PartnerLogos({ data }: PartnerLogosProps) {
  if (!data.partners || data.partners.length === 0) return null;

  return (
    <div className={clsx('grid gap-6 items-center', colClasses[data.columns] || colClasses['4'])}>
      {data.partners.map((partner, i) => {
        const content = (
          <div className="flex items-center justify-center p-4">
            {partner.logo ? (
              <Image
                src={partner.logo.url}
                alt={partner.name || ''}
                width={160}
                height={80}
                className={clsx(
                  'object-contain max-h-16',
                  data.grayscale && 'grayscale hover:grayscale-0 transition-all'
                )}
              />
            ) : (
              <span className="text-sm text-primary/60">{partner.name}</span>
            )}
          </div>
        );

        if (partner.url) {
          return (
            <a key={i} href={partner.url} target="_blank" rel="noopener noreferrer">
              {content}
            </a>
          );
        }

        return <div key={i}>{content}</div>;
      })}
    </div>
  );
}
