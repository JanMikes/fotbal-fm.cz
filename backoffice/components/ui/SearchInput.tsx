'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 400;

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Hledat…',
  className = '',
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [lastExternalValue, setLastExternalValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync external value changes (e.g. URL navigation), but never while typing
  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    if (!isTyping) {
      setInputValue(value);
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = (next: string) => {
    setInputValue(next);
    setIsTyping(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsTyping(false);
      onChangeRef.current(next);
    }, DEBOUNCE_MS);
  };

  const handleClear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsTyping(false);
    setInputValue('');
    onChangeRef.current('');
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
      <input
        type="search"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 bg-white border border-border rounded-lg text-sm
          text-text-primary placeholder:text-text-muted
          focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
          hover:border-border-light transition-all duration-200
          [&::-webkit-search-cancel-button]:hidden"
      />
      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Vymazat hledání"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded
            text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
