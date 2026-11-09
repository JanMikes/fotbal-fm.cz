'use client';

import { EyeOff, Layers } from 'lucide-react';
import type { TemplateContainerDTO } from '@/lib/social-export/api-types';
import { containerLabel, isContainerHidden } from '@/lib/social-export/container-hides';
import type { InputFieldState } from '@/lib/social-export/field-rules';

interface ContainerHideTogglesProps {
  /** The surface's HIDABLE containers (see `hidableContainers` / `unionHidableContainers`). */
  containers: TemplateContainerDTO[];
  state: Record<string, InputFieldState>;
  onChange: (containerId: string, partial: Partial<InputFieldState>) => void;
}

/**
 * One toggle per container the designer marked hidable — switching it off
 * hides the container with EVERYTHING inside it (texts, images, shapes,
 * nested groups) in the preview and the export. The members' own fields and
 * hide toggles are kept and apply again once the group is shown.
 */
export default function ContainerHideToggles({ containers, state, onChange }: ContainerHideTogglesProps) {
  if (containers.length === 0) return null;

  return (
    <section className="mt-6 border-t border-border pt-4" aria-labelledby="container-hides-title">
      <h3 id="container-hides-title" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
        <Layers className="h-4 w-4" />
        Skupiny prvků
      </h3>
      <p className="mb-3 mt-0.5 text-xs text-text-muted">
        Skrytím skupiny zmizí z obrázku celá — včetně všech textů a obrázků uvnitř.
      </p>
      <ul className="space-y-2">
        {containers.map((container, index) => {
          const hidden = isContainerHidden(container, state);
          return (
            <li key={container.id}>
              <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => onChange(container.id, { value: '', hidden: e.target.checked })}
                  className="rounded border-border"
                  data-container-hide={container.id}
                />
                {hidden && <EyeOff className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />}
                Skrýt „{containerLabel(container, index)}“
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
