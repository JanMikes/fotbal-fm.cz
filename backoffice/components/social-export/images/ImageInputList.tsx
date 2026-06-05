'use client';

import { ImageIcon } from 'lucide-react';
import ImageSlotCard from './ImageSlotCard';
import type { TemplateVariantDTO } from '@/lib/social-export/api-types';
import type { ImageSlotState } from '@/lib/social-export/field-rules-image';
import type { StrapiImage } from '@/types/match';

interface ImageInputListProps {
  variant: TemplateVariantDTO;
  matchId: string | null;
  matchImages: StrapiImage[];
  state: Record<string, ImageSlotState>;
  onChange: (slotId: string, partial: Partial<ImageSlotState>) => void;
}

/**
 * The "Obrázky" section of the export form: one editable card per image slot.
 * Renders nothing when the variant has no image placeholders.
 */
export default function ImageInputList({
  variant,
  matchId,
  matchImages,
  state,
  onChange,
}: ImageInputListProps) {
  if (variant.imageInputs.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
        <ImageIcon className="h-4 w-4" strokeWidth={2} />
        Obrázky
      </h3>
      <div className="space-y-4">
        {variant.imageInputs.map((input, index) => (
          <ImageSlotCard
            key={input.id}
            variantId={variant.id}
            matchId={matchId}
            matchImages={matchImages}
            input={input}
            index={index}
            state={state[input.id] ?? { image: null, scale: 1, offsetX: 0, offsetY: 0, rotation: 0, hidden: false }}
            onChange={(partial) => onChange(input.id, partial)}
          />
        ))}
      </div>
    </section>
  );
}
