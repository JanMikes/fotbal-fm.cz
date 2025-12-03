'use client';

import { useEffect, useState } from 'react';

interface FilterToggleProps {
  storageKey: string;
  onChange: (showOnlyMine: boolean) => void;
  defaultValue?: boolean;
}

export default function FilterToggle({
  storageKey,
  onChange,
  defaultValue = false,
}: FilterToggleProps) {
  const [showOnlyMine, setShowOnlyMine] = useState(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const value = stored === 'true';
      setShowOnlyMine(value);
      onChange(value);
    }
    setIsHydrated(true);
  }, [storageKey, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setShowOnlyMine(value);
    localStorage.setItem(storageKey, String(value));
    onChange(value);
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center gap-2 h-6">
        <div className="w-5 h-5 bg-surface-elevated rounded animate-pulse" />
        <div className="w-32 h-4 bg-surface-elevated rounded animate-pulse" />
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={showOnlyMine}
        onChange={handleChange}
        className="w-5 h-5 rounded border-border bg-white text-primary
          focus:ring-2 focus:ring-ring-focus focus:ring-offset-2 focus:ring-offset-background
          cursor-pointer transition-colors accent-primary"
      />
      <span className="text-text-secondary text-sm">Zobrazit pouze moje</span>
    </label>
  );
}
