import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Autosave status shown next to an editor title. "Uloženo" also means a
 * previously saved state was restored when the editor opened.
 */
export default function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Ukládám…
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-xs text-danger-text">
        <AlertCircle className="w-3.5 h-3.5" />
        Uložení selhalo — zkusíme to při další změně
      </span>
    );
  }

  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-success-text">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Uloženo
    </span>
  );
}
