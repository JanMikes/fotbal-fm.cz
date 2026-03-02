import type { ComponentTimeline } from '@/lib/types';

interface TimelineProps {
  data: ComponentTimeline;
}

export function Timeline({ data }: TimelineProps) {
  if (!data.items || data.items.length === 0) return null;

  return (
    <div className="relative pl-8 space-y-8">
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-accent/20" />
      {data.items.map((item, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-8 top-1 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
            {item.number || i + 1}
          </div>
          <div>
            {item.title && (
              <h4 className="font-bold text-primary mb-1">{item.title}</h4>
            )}
            {item.description && (
              <p className="text-sm text-primary/70">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
