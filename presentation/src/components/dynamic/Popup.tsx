'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { ComponentPopup } from '@/lib/types';

interface PopupProps {
  data: ComponentPopup;
}

export function Popup({ data }: PopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (data.rememberDismissal) {
      const key = `popup-dismissed-${data.id}`;
      if (localStorage.getItem(key)) return;
    }
    const timer = setTimeout(() => setIsOpen(true), 1000);
    return () => clearTimeout(timer);
  }, [data.id, data.rememberDismissal]);

  const handleClose = () => {
    setIsOpen(false);
    if (data.rememberDismissal) {
      localStorage.setItem(`popup-dismissed-${data.id}`, '1');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-primary/40 hover:text-primary transition-colors"
          aria-label="Zavřít"
        >
          <X className="w-5 h-5" />
        </button>
        {data.title && (
          <h3 className="text-xl font-bold text-primary mb-3 pr-8">{data.title}</h3>
        )}
        {data.description && (
          <div
            className="prose prose-sm max-w-none mb-4"
            dangerouslySetInnerHTML={{ __html: data.description }}
          />
        )}
        {data.link && (
          <Link
            href={data.link.href}
            onClick={handleClose}
            className="inline-block px-6 py-2 bg-accent text-white font-medium rounded hover:bg-accent/90 transition-colors"
            {...(data.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {data.link.text || 'Více'}
          </Link>
        )}
      </div>
    </div>
  );
}
