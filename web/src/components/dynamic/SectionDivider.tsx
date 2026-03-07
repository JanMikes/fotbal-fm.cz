import { clsx } from 'clsx';
import type { ComponentSectionDivider } from '@/lib/types';

interface SectionDividerProps {
  data: ComponentSectionDivider;
}

const spacingClasses: Record<string, string> = {
  S: 'my-4',
  M: 'my-8',
  L: 'my-12',
};

const styleClasses: Record<string, string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
};

export function SectionDivider({ data }: SectionDividerProps) {
  return (
    <hr
      className={clsx(
        'border-t border-primary/10',
        spacingClasses[data.spacing] || spacingClasses.M,
        styleClasses[data.style] || styleClasses.solid
      )}
    />
  );
}
