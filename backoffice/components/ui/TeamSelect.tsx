'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Team {
  id: string;
  name: string;
}

interface TeamSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export default function TeamSelect({
  value,
  onChange,
  placeholder = 'Zadejte název týmu',
  error,
}: TeamSelectProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch teams on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/teams')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setTeams(data.data.teams);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = teams.some(
    (t) => t.name.toLowerCase() === inputValue.toLowerCase()
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      onChange(val);
      setIsOpen(true);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (name: string) => {
      setInputValue(name);
      onChange(name);
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full px-4 py-2.5 bg-white border rounded-lg
          text-text-primary placeholder:text-text-muted
          focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent
          transition-all duration-200
          ${error ? 'border-danger' : 'border-border hover:border-border-light'}
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-hover`}
      />

      {isOpen && inputValue.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
          {loading && (
            <li className="px-4 py-2.5 text-text-muted text-sm">
              Načítání týmů...
            </li>
          )}

          {!loading && filtered.length === 0 && !inputValue && (
            <li className="px-4 py-2.5 text-text-muted text-sm">
              Začněte psát název týmu
            </li>
          )}

          {filtered.map((team) => (
            <li
              key={team.id}
              onMouseDown={() => handleSelect(team.name)}
              className="px-4 py-2.5 cursor-pointer hover:bg-surface-hover text-text-primary text-sm"
            >
              {team.name}
            </li>
          ))}

          {!loading && inputValue && !exactMatch && (
            <li
              onMouseDown={() => handleSelect(inputValue)}
              className="px-4 py-2.5 cursor-pointer hover:bg-surface-hover text-sm border-t border-border"
            >
              <span className="text-text-muted">Vytvořit nový tým: </span>
              <span className="font-medium text-text-primary">{inputValue}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
