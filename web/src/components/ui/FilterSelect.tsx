'use client';

import { ChevronDown } from 'lucide-react';

interface FilterSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}

export default function FilterSelect({ label, value, options, onChange, className }: FilterSelectProps) {
  return (
    <label className={`relative inline-flex items-center ${className ?? ''}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="appearance-none rounded-full bg-surface-light pl-5 pr-10 py-2.5 text-xs sm:text-sm font-semibold uppercase tracking-wide text-primary shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 w-full"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-primary/50 absolute right-4 pointer-events-none" />
    </label>
  );
}
