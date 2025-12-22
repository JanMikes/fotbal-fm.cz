'use client';

import Select, { MultiValue, ClassNamesConfig } from 'react-select';
import { useCategories } from '@/hooks/api';
import { Category } from '@/types/category';

interface CategorySelectProps {
  value: string[];
  onChange: (categoryIds: string[]) => void;
  error?: string;
  required?: boolean;
}

interface CategoryOption {
  value: string;
  label: string;
}

export default function CategorySelect({
  value,
  onChange,
  error,
}: CategorySelectProps) {
  const { categories, isLoading } = useCategories();

  // Transform categories to react-select options
  const options: CategoryOption[] = categories.map((cat: Category) => ({
    value: cat.id,
    label: cat.name,
  }));

  // Get selected options from value prop
  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  // Handle selection change
  const handleChange = (selected: MultiValue<CategoryOption>) => {
    onChange(selected ? selected.map((opt) => opt.value) : []);
  };

  // Define classNames for Tailwind styling
  const selectClassNames: ClassNamesConfig<CategoryOption, true> = {
    control: ({ isFocused }) =>
      `w-full px-2 py-0.5 bg-white border rounded-lg transition-all duration-200 min-h-[42px] ${
        error
          ? 'border-danger'
          : isFocused
            ? 'ring-2 ring-ring-focus border-transparent'
            : 'border-border hover:border-border-light'
      }`,
    placeholder: () => 'text-text-muted',
    input: () => 'text-text-primary',
    valueContainer: () => 'gap-1 py-1',
    multiValue: () => 'bg-accent text-white rounded-full',
    multiValueLabel: () => 'px-2 py-0.5 text-sm font-medium text-white',
    multiValueRemove: () =>
      'px-1 rounded-r-full hover:bg-accent-hover hover:text-white transition-colors',
    indicatorsContainer: () => 'text-text-muted',
    dropdownIndicator: ({ isFocused }) =>
      `p-2 transition-colors ${
        isFocused ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
      }`,
    clearIndicator: () =>
      'p-2 text-text-muted hover:text-danger transition-colors',
    indicatorSeparator: () => 'bg-border',
    menu: () =>
      'mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden z-50',
    menuList: () => 'py-1 max-h-60',
    option: ({ isFocused, isSelected }) =>
      `px-3 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-accent text-white'
          : isFocused
            ? 'bg-surface-hover text-text-primary'
            : 'text-text-primary hover:bg-surface-hover'
      }`,
    noOptionsMessage: () => 'text-text-muted py-3 text-center',
    loadingMessage: () => 'text-text-muted py-3 text-center',
  };

  return (
    <div className="space-y-2">
      <Select<CategoryOption, true>
        isMulti
        unstyled
        options={options}
        value={selectedOptions}
        onChange={handleChange}
        isLoading={isLoading}
        isDisabled={isLoading}
        placeholder="Vyberte kategorie..."
        noOptionsMessage={() => 'Žádné kategorie nenalezeny'}
        loadingMessage={() => 'Načítání...'}
        classNames={selectClassNames}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
