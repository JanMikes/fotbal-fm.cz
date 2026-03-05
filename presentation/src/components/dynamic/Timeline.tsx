'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { ComponentTimeline } from '@/lib/types';

interface TimelineProps {
  data: ComponentTimeline;
}

export function Timeline({ data }: TimelineProps) {
  if (!data.items || data.items.length === 0) return null;

  if (data.style === 'style2') {
    return <TimelineTable items={data.items} collapsible={data.collapsible} />;
  }

  return <TimelineVertical items={data.items} collapsible={data.collapsible} />;
}

type TimelineItem = ComponentTimeline['items'][0];

function TimelineVertical({ items, collapsible }: { items: TimelineItem[]; collapsible: boolean }) {
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <TimelineVerticalItem
          key={i}
          item={item}
          index={i}
          collapsible={collapsible}
          isLast={i === items.length - 1}
        />
      ))}
    </div>
  );
}

function TimelineVerticalItem({
  item,
  index,
  collapsible,
  isLast,
}: {
  item: TimelineItem;
  index: number;
  collapsible: boolean;
  isLast: boolean;
}) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const label = item.number || String(index + 1);

  return (
    <div className="flex gap-4">
      {/* Line + Point column */}
      <div className="flex flex-col items-center">
        <div className="min-w-8 min-h-8 px-2 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
          {label}
        </div>
        {/* Vertical line extending through content */}
        {!isLast && <div className="w-0.5 bg-accent/20 flex-1" />}
        {isLast && <div className="w-0.5 bg-accent/20 flex-1 min-h-4" />}
      </div>

      {/* Content column */}
      <div className={clsx('pb-6 flex-1 min-w-0', isLast && 'pb-0')}>
        {collapsible ? (
          <>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 text-left w-full"
            >
              <h4 className="font-bold text-primary">{item.title}</h4>
              <ChevronDown
                className={clsx(
                  'w-4 h-4 text-primary/40 transition-transform shrink-0',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
            {isOpen && item.description && (
              <p className="text-sm text-primary/70 mt-1">{item.description}</p>
            )}
          </>
        ) : (
          <>
            {item.title && (
              <h4 className="font-bold text-primary mb-1">{item.title}</h4>
            )}
            {item.description && (
              <p className="text-sm text-primary/70">{item.description}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TimelineTable({ items, collapsible }: { items: TimelineItem[]; collapsible: boolean }) {
  return (
    <div className="divide-y divide-primary/10">
      {items.map((item, i) => (
        <TimelineTableRow key={i} item={item} collapsible={collapsible} />
      ))}
    </div>
  );
}

function TimelineTableRow({ item, collapsible }: { item: TimelineItem; collapsible: boolean }) {
  const [isOpen, setIsOpen] = useState(!collapsible);

  if (collapsible) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-3 text-left"
        >
          <span className="font-bold text-primary flex items-center gap-2">
            {item.title}
            <ChevronDown
              className={clsx(
                'w-4 h-4 text-primary/40 transition-transform shrink-0',
                isOpen && 'rotate-180'
              )}
            />
          </span>
          <span className="text-accent font-semibold text-center min-w-[4rem]">
            {item.number}
          </span>
          <span className="text-sm text-primary/70">
            {isOpen ? item.description : ''}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-3">
      <span className="font-bold text-primary">{item.title}</span>
      <span className="text-accent font-semibold text-center min-w-[4rem]">
        {item.number}
      </span>
      <span className="text-sm text-primary/70">{item.description}</span>
    </div>
  );
}
