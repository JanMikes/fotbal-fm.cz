import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import type { BreadcrumbItem } from '@/lib/types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-primary/50">
        <li className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only">Domů</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-primary/30" />
              {isLast ? (
                <span className="text-primary/70 font-medium">{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-accent transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
