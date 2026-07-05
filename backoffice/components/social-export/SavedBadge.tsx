import { CheckCircle2 } from 'lucide-react';

/**
 * Small "Uloženo" pill shown on template/variant cards that already have a
 * saved editing state for the current match.
 */
export default function SavedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-success-border bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-text ${className}`}
    >
      <CheckCircle2 className="w-3 h-3" />
      Uloženo
    </span>
  );
}
