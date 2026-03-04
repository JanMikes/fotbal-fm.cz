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
    <div className="inline-flex items-center bg-primary px-8 py-5 gap-8 mb-12">
      <h2 className="text-section text-white uppercase font-black leading-tight">
        {title}
      </h2>
      {moreLink && (
        <Link
          href={moreLink}
          className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors"
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
