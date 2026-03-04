'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { Match } from '@/lib/types';

const CZECH_MONTHS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

const CZECH_DAYS_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

interface MiniCalendarProps {
  matches: Match[];
  selectedDate: string | null;
  onDaySelect: (date: string | null) => void;
  className?: string;
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  // Monday = 0, Sunday = 6
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }
  return days;
}

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export default function MiniCalendar({ matches, selectedDate, onDaySelect, className }: MiniCalendarProps) {
  const [todayKey, setTodayKey] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    const now = new Date();
    setTodayKey(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);
  const [direction, setDirection] = useState(0);

  const matchesByDate = useMemo(() => {
    const map = new Map<string, { upcoming: number; finished: number }>();
    for (const match of matches) {
      const dateKey = match.rawMatchDate;
      const existing = map.get(dateKey) || { upcoming: 0, finished: 0 };
      if (match.status === 'upcoming') {
        existing.upcoming++;
      } else {
        existing.finished++;
      }
      map.set(dateKey, existing);
    }
    return map;
  }, [matches]);

  const days = useMemo(() => getCalendarDays(currentYear, currentMonth), [currentYear, currentMonth]);

  function goToPrevMonth() {
    setDirection(-1);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    setDirection(1);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleDayClick(day: number) {
    const dateKey = formatDateKey(currentYear, currentMonth, day);
    if (selectedDate === dateKey) {
      onDaySelect(null);
    } else {
      onDaySelect(dateKey);
    }
  }

  return (
    <div className={clsx('bg-white shadow-card p-4', className)}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-1.5 hover:bg-surface-light transition-colors"
          aria-label="Předchozí měsíc"
        >
          <ChevronLeft className="w-5 h-5 text-primary/60" />
        </button>
        <span className="text-sm font-semibold text-primary uppercase tracking-wide">
          {CZECH_MONTHS[currentMonth]} {currentYear}
        </span>
        <button
          onClick={goToNextMonth}
          className="p-1.5 hover:bg-surface-light transition-colors"
          aria-label="Další měsíc"
        >
          <ChevronRight className="w-5 h-5 text-primary/60" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {CZECH_DAYS_SHORT.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-primary/40 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${currentYear}-${currentMonth}`}
          initial={{ opacity: 0, x: direction * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -30 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7"
        >
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateKey = formatDateKey(currentYear, currentMonth, day);
            const matchInfo = matchesByDate.get(dateKey);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;
            const hasMatches = !!matchInfo;

            return (
              <button
                key={dateKey}
                onClick={() => handleDayClick(day)}
                className={clsx(
                  'aspect-square flex flex-col items-center justify-center relative text-sm transition-all',
                  'min-w-[40px]',
                  isSelected && 'bg-accent text-white',
                  !isSelected && isToday && 'ring-2 ring-accent ring-inset',
                  !isSelected && !isToday && hasMatches && 'hover:bg-surface-light',
                  !isSelected && !isToday && !hasMatches && 'text-primary/40',
                  !isSelected && hasMatches && 'text-primary font-medium',
                )}
              >
                <span>{day}</span>
                {hasMatches && (
                  <div className="flex gap-0.5 mt-0.5">
                    {matchInfo.upcoming > 0 && (
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        isSelected ? 'bg-white' : 'bg-accent'
                      )} />
                    )}
                    {matchInfo.finished > 0 && (
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        isSelected ? 'bg-white/60' : 'bg-primary/30'
                      )} />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
