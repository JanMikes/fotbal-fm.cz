'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}

function getPageItems(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const items: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev === 2) {
      items.push(prev + 1);
    } else if (p - prev > 2) {
      items.push('ellipsis');
    }
    items.push(p);
    prev = p;
  }
  return items;
}

function formatTotal(total: number): string {
  if (total === 1) return '1 záznam';
  if (total >= 2 && total <= 4) return `${total} záznamy`;
  return `${total} záznamů`;
}

export default function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const buttonBase = `min-w-9 h-9 px-2 inline-flex items-center justify-center rounded-lg
    text-sm font-medium transition-colors
    disabled:opacity-40 disabled:cursor-not-allowed`;

  return (
    <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-sm text-text-muted">Celkem {formatTotal(total)}</p>
      <nav className="flex items-center gap-1" aria-label="Stránkování">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Předchozí stránka"
          className={`${buttonBase} border border-border bg-surface text-text-secondary hover:bg-surface-hover`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {getPageItems(page, pageCount).map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="min-w-9 h-9 inline-flex items-center justify-center text-sm text-text-muted"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={`${buttonBase} ${
                item === page
                  ? 'bg-primary text-white'
                  : 'border border-border bg-surface text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Další stránka"
          className={`${buttonBase} border border-border bg-surface text-text-secondary hover:bg-surface-hover`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  );
}
