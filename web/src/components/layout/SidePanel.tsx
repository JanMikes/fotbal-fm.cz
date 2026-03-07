import { clsx } from 'clsx';

interface SidePanelProps {
  children: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export default function SidePanel({ children, sticky = true, className }: SidePanelProps) {
  return (
    <aside
      className={clsx(
        sticky && 'lg:sticky lg:top-36 lg:self-start',
        className
      )}
    >
      <div className="space-y-6">
        {children}
      </div>
    </aside>
  );
}
