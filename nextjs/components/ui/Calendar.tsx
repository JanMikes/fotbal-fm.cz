'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { cs } from 'date-fns/locale';

export interface CalendarIndicators {
  matches: number;
  tournaments: number;
  events: number;
}

interface CalendarProps {
  currentMonth: Date;
  selectedDate: Date | null;
  onMonthChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
  indicators: Map<string, CalendarIndicators>;
}

const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function Calendar({
  currentMonth,
  selectedDate,
  onMonthChange,
  onDayClick,
  indicators,
}: CalendarProps) {
  const today = new Date();

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const handlePrevMonth = () => {
    onMonthChange(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  const getDateKey = (date: Date): string => {
    return format(date, 'yyyy-MM-dd');
  };

  const getDayIndicators = (date: Date): CalendarIndicators | undefined => {
    return indicators.get(getDateKey(date));
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          aria-label="Předchozí měsíc"
        >
          <ChevronLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <h3 className="text-lg font-semibold text-text-primary capitalize">
          {format(currentMonth, 'LLLL yyyy', { locale: cs })}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          aria-label="Následující měsíc"
        >
          <ChevronRight className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-text-muted uppercase py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayIndicators = getDayIndicators(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`
                relative h-12 w-full flex flex-col items-center justify-center rounded-lg transition-colors
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isToday ? 'bg-accent/20 font-bold' : ''}
                ${isSelected ? 'ring-2 ring-primary bg-primary/10' : ''}
                ${!isToday && !isSelected ? 'hover:bg-surface-hover' : ''}
              `}
              aria-label={format(day, 'd MMMM yyyy', { locale: cs })}
              aria-selected={isSelected || undefined}
            >
              <span
                className={`
                  text-sm
                  ${isToday ? 'text-accent' : 'text-text-primary'}
                  ${isSelected ? 'text-primary font-semibold' : ''}
                `}
              >
                {format(day, 'd')}
              </span>

              {/* Indicator dots */}
              {dayIndicators && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayIndicators.matches > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  {dayIndicators.tournaments > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                  {dayIndicators.events > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
