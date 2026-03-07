import { clsx } from 'clsx';
import type { ComponentStatsHighlights } from '@/lib/types';

interface StatsHighlightsProps {
  data: ComponentStatsHighlights;
}

const colClasses: Record<string, string> = {
  '2': 'grid-cols-1 sm:grid-cols-2',
  '3': 'grid-cols-1 sm:grid-cols-3',
  '4': 'grid-cols-2 sm:grid-cols-4',
};

export function StatsHighlights({ data }: StatsHighlightsProps) {
  if (!data.items || data.items.length === 0) return null;

  return (
    <div className={clsx('grid gap-6', colClasses[data.columns] || colClasses['4'])}>
      {data.items.map((item, i) => (
        <div key={i} className="text-center p-6 bg-white rounded-lg shadow-card">
          {item.number && (
            <p className="text-3xl lg:text-4xl font-black text-accent number-display mb-2">
              {item.number}
            </p>
          )}
          {item.title && (
            <p className="font-semibold text-primary mb-1">{item.title}</p>
          )}
          {item.description && (
            <p className="text-sm text-primary/60">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
