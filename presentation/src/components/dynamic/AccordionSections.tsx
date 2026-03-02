'use client';

import { useState } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';
import { ChevronDown, FileText, Download } from 'lucide-react';
import type { ComponentAccordionSections } from '@/lib/types';

interface AccordionSectionsProps {
  data: ComponentAccordionSections;
}

export function AccordionSections({ data }: AccordionSectionsProps) {
  if (!data.sections || data.sections.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.sections.map((section, i) => (
        <AccordionItem key={i} section={section} />
      ))}
    </div>
  );
}

function AccordionItem({ section }: { section: ComponentAccordionSections['sections'][0] }) {
  const [isOpen, setIsOpen] = useState(section.default_open);

  return (
    <div className="border border-primary/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-surface-light transition-colors"
      >
        <span className="font-medium text-primary">{section.title}</span>
        <ChevronDown
          className={clsx(
            'w-5 h-5 text-primary/40 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div className="p-4 pt-0 bg-white space-y-4">
          {section.description && (
            <div
              className="prose prose-sm max-w-none text-primary/70"
              dangerouslySetInnerHTML={{ __html: section.description }}
            />
          )}
          {section.files && section.files.length > 0 && (
            <div className="space-y-2">
              {section.files.map((doc, j) => (
                <a
                  key={j}
                  href={doc.file?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <FileText className="w-4 h-4" />
                  {doc.name || 'Dokument'}
                  <Download className="w-3 h-3 ml-auto" />
                </a>
              ))}
            </div>
          )}
          {section.photos && section.photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {section.photos.filter((p) => p.image).map((photo, j) => (
                <div key={j} className="relative aspect-[4/3] rounded overflow-hidden">
                  <Image
                    src={photo.image!.url}
                    alt={photo.image!.alternativeText || ''}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
