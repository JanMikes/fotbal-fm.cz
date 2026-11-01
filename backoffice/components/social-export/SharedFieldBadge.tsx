import { Link2 } from 'lucide-react';

/**
 * "Společné pole" pill on a document page's input / picture slot that a
 * shared field fills: its value is the shared one on every bound page
 * (editing it here edits the shared field — the two stay mirrored).
 */
export default function SharedFieldBadge({
  name,
  kind,
  className = '',
}: {
  /** The shared field's name. */
  name: string;
  kind: 'text' | 'image';
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[11px] font-medium text-accent ${className}`}
      title={
        kind === 'text'
          ? `Společné pole „${name}“ — text platí na všech stranách, kde je pole použito. Formátování se u něj neuplatní.`
          : `Společné pole „${name}“ — obrázek platí na všech stranách, kde je pole použito. Umístění je na každé straně vlastní.`
      }
    >
      <Link2 className="h-3 w-3 shrink-0" />
      <span className="truncate">Společné pole: {name}</span>
    </span>
  );
}
