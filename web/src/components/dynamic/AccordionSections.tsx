'use client';

import { useState } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';
import { ChevronDown, FileText, Download, Mail, Phone } from 'lucide-react';
import type { ComponentAccordionSections } from '@/lib/types';
import { MarkdownContent } from '../ui/MarkdownContent';

interface AccordionSectionsProps {
  data: ComponentAccordionSections;
  sidebar?: boolean;
}

export function AccordionSections({ data, sidebar }: AccordionSectionsProps) {
  if (!data.sections || data.sections.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.sections.map((section, i) => (
        <AccordionItem key={i} section={section} sidebar={sidebar} />
      ))}
    </div>
  );
}

function AccordionItem({ section, sidebar }: { section: ComponentAccordionSections['sections'][0]; sidebar?: boolean }) {
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
        <div className="p-4 bg-white space-y-4">
          {section.description && (
            <MarkdownContent content={section.description} className="prose-sm text-primary/70" />
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
            <div className={sidebar ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 sm:grid-cols-3 gap-2'}>
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
          {section.contacts && section.contacts.length > 0 && (
            <div className={sidebar ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}>
              {section.contacts.map((contact, j) => (
                <div key={j} className="flex items-center gap-3 p-3 bg-surface-light rounded-lg">
                  {contact.photo && (
                    <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden">
                      <Image
                        src={contact.photo.url}
                        alt={contact.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-primary">{contact.name}</p>
                    {contact.role && (
                      <p className="text-xs text-primary/60 mb-1.5">{contact.role}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-primary/70 hover:text-accent transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-primary/70 hover:text-accent transition-colors">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
