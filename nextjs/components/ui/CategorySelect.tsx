'use client';

import { useCategories } from '@/hooks/api';
import { Category } from '@/types/category';

interface CategorySelectProps {
  value: string[];
  onChange: (categoryIds: string[]) => void;
  error?: string;
  required?: boolean;
}

export default function CategorySelect({
  value,
  onChange,
  error,
  required,
}: CategorySelectProps) {
  const { categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-surface-hover h-8 w-20 rounded-full"
          />
        ))}
      </div>
    );
  }

  const toggleCategory = (categoryId: string) => {
    if (value.includes(categoryId)) {
      onChange(value.filter((id) => id !== categoryId));
    } else {
      onChange([...value, categoryId]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {categories.map((category: Category) => {
          const isSelected = value.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategory(category.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${
                  isSelected
                    ? 'bg-accent text-white'
                    : 'bg-surface-hover text-text-secondary hover:bg-surface-hover/80 hover:text-text-primary'
                }
                focus:outline-none focus:ring-2 focus:ring-ring-focus focus:ring-offset-2
              `}
            >
              {category.name}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
