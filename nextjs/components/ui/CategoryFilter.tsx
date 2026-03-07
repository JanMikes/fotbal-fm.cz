'use client';

import { useCategories } from '@/hooks/api';
import { Category } from '@/types/category';

interface CategoryFilterProps {
  value: string;
  onChange: (categoryId: string) => void;
}

export default function CategoryFilter({
  value,
  onChange,
}: CategoryFilterProps) {
  const { categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 bg-surface-elevated rounded-full animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          value === ''
            ? 'bg-accent text-white'
            : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
        }`}
      >
        Vše
      </button>
      {categories.map((cat: Category) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            value === cat.id
              ? 'bg-accent text-white'
              : 'bg-surface-elevated text-text-secondary hover:bg-surface-hover'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
