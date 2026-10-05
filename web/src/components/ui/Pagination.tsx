import Link from 'next/link';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { generatePageNumbers, buildPageHref } from '@/lib/pagination';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseHref: string;
  paramName?: string;
}

export default function Pagination({ currentPage, totalPages, baseHref, paramName = 'stranka' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = generatePageNumbers(currentPage, totalPages);

  const linkClass = 'inline-flex items-center justify-center w-10 h-10 text-sm font-medium transition-colors';

  // The page links don't prefetch: every page is dynamic and has no loading.tsx, so a prefetch
  // gets no page data, yet costs two server requests per visible link.
  return (
    <nav className="flex items-center justify-center gap-1 mt-12" aria-label="Stránkování">
      {currentPage > 1 ? (
        <Link
          href={buildPageHref(baseHref, currentPage - 1, paramName)}
          prefetch={false}
          className={clsx(linkClass, 'text-primary/60 hover:text-accent')}
          aria-label="Předchozí stránka"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
      ) : (
        <span className={clsx(linkClass, 'text-primary/20 cursor-default')}>
          <ChevronLeft className="w-5 h-5" />
        </span>
      )}

      {pages.map((page, i) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className={clsx(linkClass, 'text-primary/40 cursor-default')}>
            ...
          </span>
        ) : page === currentPage ? (
          <span
            key={page}
            className={clsx(linkClass, 'bg-accent text-white rounded-full')}
            aria-current="page"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={buildPageHref(baseHref, page, paramName)}
            prefetch={false}
            className={clsx(linkClass, 'text-primary/60 hover:text-accent hover:bg-accent/5 rounded-full')}
          >
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildPageHref(baseHref, currentPage + 1, paramName)}
          prefetch={false}
          className={clsx(linkClass, 'text-primary/60 hover:text-accent')}
          aria-label="Další stránka"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      ) : (
        <span className={clsx(linkClass, 'text-primary/20 cursor-default')}>
          <ChevronRight className="w-5 h-5" />
        </span>
      )}
    </nav>
  );
}
