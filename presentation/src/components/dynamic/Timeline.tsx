'use client';

import { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import { MarkdownContent } from '../ui/MarkdownContent';
import type { ComponentTimeline } from '@/lib/types';

interface TimelineProps {
  data: ComponentTimeline;
}

export function Timeline({ data }: TimelineProps) {
  if (!data.items || data.items.length === 0) return null;

  if (data.style === 'style2') {
    return <TimelineTable items={data.items} collapsible={data.collapsible} showPreview={data.showPreview} />;
  }

  return <TimelineVertical items={data.items} collapsible={data.collapsible} showPreview={data.showPreview} />;
}

type TimelineItem = ComponentTimeline['items'][0];

function TimelineVertical({ items, collapsible, showPreview }: { items: TimelineItem[]; collapsible: boolean; showPreview: boolean }) {
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <TimelineVerticalItem
          key={i}
          item={item}
          index={i}
          collapsible={collapsible}
          showPreview={showPreview}
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
  showPreview,
  isLast,
}: {
  item: TimelineItem;
  index: number;
  collapsible: boolean;
  showPreview: boolean;
  isLast: boolean;
}) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const [needsCollapsing, setNeedsCollapsing] = useState(collapsible);
  const label = item.number || String(index + 1);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !collapsible || !item.description) return;
    if (node.scrollHeight <= node.clientHeight) {
      setNeedsCollapsing(false);
      setIsOpen(true);
    }
  }, [collapsible, item.description]);

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
      <div className={clsx('pb-6 flex-1 min-w-0 relative', isLast && 'pb-0')}>
        {/* Hidden measurement div to check if content overflows line-clamp-3 */}
        {collapsible && needsCollapsing && item.description && (
          <div
            ref={measureRef}
            className="line-clamp-3 text-sm absolute left-0 right-0 opacity-0 pointer-events-none -z-10"
            aria-hidden="true"
          >
            <MarkdownContent content={item.description} className="prose-sm" />
          </div>
        )}
        {collapsible ? (
          <>
            {needsCollapsing ? (
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
            ) : (
              <h4 className="font-bold text-primary">{item.title}</h4>
            )}
            {item.description && (
              isOpen ? (
                <MarkdownContent
                  content={item.description}
                  className="text-sm text-primary/70 mt-1 prose-sm"
                />
              ) : showPreview ? (
                <div className="text-sm text-primary/70 mt-1 line-clamp-3">
                  <MarkdownContent
                    content={item.description}
                    className="prose-sm"
                  />
                </div>
              ) : null
            )}
          </>
        ) : (
          <>
            {item.title && (
              <h4 className="font-bold text-primary mb-1">{item.title}</h4>
            )}
            {item.description && (
              <MarkdownContent
                content={item.description}
                className="text-sm text-primary/70 prose-sm"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TimelineTable({ items, collapsible, showPreview }: { items: TimelineItem[]; collapsible: boolean; showPreview: boolean }) {
  return (
    <div className="divide-y divide-primary/10">
      {items.map((item, i) => (
        <TimelineTableRow key={i} item={item} collapsible={collapsible} showPreview={showPreview} />
      ))}
    </div>
  );
}

function TimelineTableRow({ item, collapsible, showPreview }: { item: TimelineItem; collapsible: boolean; showPreview: boolean }) {
  const [isOpen, setIsOpen] = useState(!collapsible);
  const [needsCollapsing, setNeedsCollapsing] = useState(collapsible);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !collapsible || !item.description) return;
    if (node.scrollHeight <= node.clientHeight) {
      setNeedsCollapsing(false);
      setIsOpen(true);
    }
  }, [collapsible, item.description]);

  if (collapsible) {
    return (
      <div className="py-3 relative">
        {/* Hidden measurement div */}
        {needsCollapsing && item.description && (
          <div
            ref={measureRef}
            className="line-clamp-3 text-sm absolute left-0 right-0 opacity-0 pointer-events-none -z-10"
            aria-hidden="true"
          >
            <MarkdownContent content={item.description} className="prose-sm" />
          </div>
        )}
        <div className="flex flex-col gap-1 md:grid md:grid-cols-[auto_auto_1fr_auto] md:gap-x-4 md:items-start text-left">
          <span className="text-accent font-semibold min-w-[4rem] md:text-center">
            {item.number}
          </span>
          <span className="font-bold text-primary">
            {item.title}
          </span>
          <span className="text-sm text-primary/70">
            {item.description && (
              isOpen ? (
                <MarkdownContent
                  content={item.description}
                  className="prose-sm"
                />
              ) : showPreview ? (
                <div className="line-clamp-3">
                  <MarkdownContent
                    content={item.description}
                    className="prose-sm"
                  />
                </div>
              ) : null
            )}
          </span>
          {needsCollapsing && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-7 h-7 rounded-full border-2 border-accent flex items-center justify-center shrink-0 hover:bg-accent/10 transition-colors"
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              <ChevronDown
                className={clsx(
                  'w-4 h-4 text-accent transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-3 md:grid md:grid-cols-[auto_auto_1fr] md:gap-x-4 md:items-start">
      <span className="text-accent font-semibold min-w-[4rem] md:text-center">
        {item.number}
      </span>
      <span className="font-bold text-primary">{item.title}</span>
      <span className="text-sm text-primary/70">
        {item.description && (
          <MarkdownContent
            content={item.description}
            className="prose-sm"
          />
        )}
      </span>
    </div>
  );
}
