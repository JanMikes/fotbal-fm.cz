import { clsx } from 'clsx';
import { FileText, Download } from 'lucide-react';
import type { ComponentDocuments } from '@/lib/types';

interface DocumentsProps {
  data: ComponentDocuments;
  sidebar?: boolean;
}

const colClasses: Record<string, string> = {
  '1': 'grid-cols-1',
  '2': 'grid-cols-1 sm:grid-cols-2',
  '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

export function Documents({ data, sidebar }: DocumentsProps) {
  if (!data.documents || data.documents.length === 0) return null;

  return (
    <div className={clsx('grid gap-3', sidebar ? 'grid-cols-1' : (colClasses[data.columns] || colClasses['3']))}>
      {data.documents.map((doc, i) => (
        <a
          key={i}
          href={doc.file?.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow group"
        >
          <FileText className="w-8 h-8 text-accent shrink-0" />
          <span className="flex-1 text-sm font-medium text-primary group-hover:text-accent transition-colors truncate">
            {doc.name || 'Dokument'}
          </span>
          <Download className="w-4 h-4 text-primary/40 shrink-0" />
        </a>
      ))}
    </div>
  );
}
