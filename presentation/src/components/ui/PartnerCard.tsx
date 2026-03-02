import Image from 'next/image';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { Partner } from '@/lib/types';

interface PartnerCardProps {
  partner: Partner;
  className?: string;
}

export default function PartnerCard({ partner, className }: PartnerCardProps) {
  return (
    <Link href={`/partner/${partner.slug}`} className="block">
      <article
        className={clsx(
          'group bg-white overflow-hidden shadow-card card-lift cursor-pointer h-full flex flex-col items-center p-6',
          className,
        )}
      >
        {partner.logo ? (
          <div className="relative w-full aspect-[3/2] mb-4">
            <Image
              src={partner.logo.url}
              alt={partner.name}
              fill
              className="object-contain transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="w-full aspect-[3/2] mb-4 bg-surface-light flex items-center justify-center">
            <span className="text-primary/30 text-4xl font-bold">{partner.name.charAt(0)}</span>
          </div>
        )}
        <h3 className="font-bold text-primary text-center group-hover:text-accent transition-colors duration-300">
          {partner.name}
        </h3>
        {partner.description && (
          <p className="text-small text-primary/60 text-center line-clamp-2 mt-2">
            {partner.description}
          </p>
        )}
      </article>
    </Link>
  );
}
