import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  icon: LucideIcon;
  moreLink?: string;
  moreLabel?: string;
}

export default function SectionHeader({ title, icon: Icon, moreLink, moreLabel = 'Více' }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-8 mb-12">
      <div>
        <h2 className="text-section text-primary uppercase font-black leading-tight">
          {title}
        </h2>
        <div className="w-24 h-1 bg-accent mt-3" />
      </div>
      {moreLink && (
        <Link
          href={moreLink}
          className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition-colors self-start mt-1"
        >
          <Icon className="w-5 h-5" />
          <span className="text-sm font-bold uppercase tracking-wide border-b-2 border-accent pb-0.5">
            {moreLabel}
          </span>
        </Link>
      )}
    </div>
  );
}
