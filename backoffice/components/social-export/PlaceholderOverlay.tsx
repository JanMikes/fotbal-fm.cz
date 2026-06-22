'use client';

import PlaceholderBox from './PlaceholderBox';
import {
  resolveInputLabel,
  isEditable,
} from '@/lib/social-export/field-rules';
import { resolveImageLabel } from '@/lib/social-export/field-rules-image';
import { canvasToDisplay } from '@/lib/social-export/geometry';
import type { TemplateVariantDTO } from '@/lib/social-export/api-types';

/** Identifies which kind of placeholder a box belongs to. */
export type ActivePlaceholder =
  | { kind: 'text'; id: string }
  | { kind: 'image'; id: string };

interface PlaceholderOverlayProps {
  variant: TemplateVariantDTO;
  /** canvas-px → display-px factor (renderedImgWidth / variant.width). */
  scale: number;
  active: ActivePlaceholder | null;
  onSelect: (placeholder: ActivePlaceholder) => void;
}

/**
 * Absolutely-positioned overlay (sized to the rendered image rect) that draws a
 * highlight box per placeholder with a non-null frame. Text and image slots are
 * both drawn; locked text inputs render as non-interactive boxes (no pencil).
 * Inputs without a frame are not drawable — they remain editable via the flat form.
 */
export default function PlaceholderOverlay({
  variant,
  scale,
  active,
  onSelect,
}: PlaceholderOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Text placeholders */}
      {variant.inputs.map((input, index) => {
        if (!input.frame) return null;
        const editable = isEditable(input);
        return (
          <PlaceholderBox
            key={`text-${input.id}`}
            rect={canvasToDisplay(input.frame, scale)}
            label={resolveInputLabel(input, index)}
            active={active?.kind === 'text' && active.id === input.id}
            readOnly={!editable}
            onEdit={() => onSelect({ kind: 'text', id: input.id })}
          />
        );
      })}

      {/* Image placeholders */}
      {variant.imageInputs.map((input, index) => {
        if (!input.frame) return null;
        return (
          <PlaceholderBox
            key={`image-${input.id}`}
            rect={canvasToDisplay(input.frame, scale)}
            label={resolveImageLabel(input, index)}
            active={active?.kind === 'image' && active.id === input.id}
            onEdit={() => onSelect({ kind: 'image', id: input.id })}
          />
        );
      })}
    </div>
  );
}
