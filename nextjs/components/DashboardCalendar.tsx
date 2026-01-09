'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Target, Trophy, CalendarDays } from 'lucide-react';
import Calendar, { CalendarIndicators } from '@/components/ui/Calendar';
import Card from '@/components/ui/Card';
import { MatchResult } from '@/types/match-result';
import { Tournament } from '@/types/tournament';
import { Event } from '@/types/event';
import { Category } from '@/types/category';

interface DashboardCalendarProps {
  matchResults: MatchResult[];
  tournaments: Tournament[];
  events: Event[];
}

interface CalendarItem {
  id: string;
  type: 'match' | 'tournament' | 'event';
  title: string;
  subtitle?: string;
  date: Date;
  link: string;
  categories?: Category[];
}

export default function DashboardCalendar({
  matchResults,
  tournaments,
  events,
}: DashboardCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Build indicators map for calendar dots
  const indicators = useMemo(() => {
    const map = new Map<string, CalendarIndicators>();

    const addIndicator = (dateKey: string, type: keyof CalendarIndicators) => {
      const existing = map.get(dateKey) || { matches: 0, tournaments: 0, events: 0 };
      existing[type]++;
      map.set(dateKey, existing);
    };

    const getDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

    const getDateRange = (dateFrom: string, dateTo?: string): Date[] => {
      const start = parseISO(dateFrom);
      const end = dateTo ? parseISO(dateTo) : start;

      // Limit to 365 days to prevent performance issues
      const maxDays = 365;
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > maxDays) {
        return [start];
      }

      return eachDayOfInterval({ start, end });
    };

    // Match results: single date
    matchResults.forEach((mr) => {
      const date = parseISO(mr.matchDate);
      addIndicator(getDateKey(date), 'matches');
    });

    // Tournaments: date range
    tournaments.forEach((t) => {
      const dates = getDateRange(t.dateFrom, t.dateTo);
      dates.forEach((date) => addIndicator(getDateKey(date), 'tournaments'));
    });

    // Events: date range
    events.forEach((e) => {
      const dates = getDateRange(e.dateFrom, e.dateTo);
      dates.forEach((date) => addIndicator(getDateKey(date), 'events'));
    });

    return map;
  }, [matchResults, tournaments, events]);

  // Get items for selected date
  const selectedItems = useMemo((): CalendarItem[] => {
    if (!selectedDate) return [];

    const items: CalendarItem[] = [];

    // Check match results
    matchResults.forEach((mr) => {
      const matchDate = parseISO(mr.matchDate);
      if (isSameDay(matchDate, selectedDate)) {
        items.push({
          id: mr.id,
          type: 'match',
          title: `${mr.homeTeam} ${mr.homeScore}:${mr.awayScore} ${mr.awayTeam}`,
          date: matchDate,
          link: `/vysledek/${mr.id}`,
          categories: mr.categories,
        });
      }
    });

    // Check tournaments
    tournaments.forEach((t) => {
      const start = parseISO(t.dateFrom);
      const end = t.dateTo ? parseISO(t.dateTo) : start;

      if (selectedDate >= start && selectedDate <= end) {
        items.push({
          id: t.id,
          type: 'tournament',
          title: t.name,
          subtitle: t.location,
          date: start,
          link: `/turnaj/${t.id}`,
          categories: t.categories,
        });
      }
    });

    // Check events
    events.forEach((e) => {
      const start = parseISO(e.dateFrom);
      const end = e.dateTo ? parseISO(e.dateTo) : start;

      if (selectedDate >= start && selectedDate <= end) {
        items.push({
          id: e.id,
          type: 'event',
          title: e.name,
          subtitle: e.eventTime ? `${e.eventTime}${e.eventTimeTo ? ` - ${e.eventTimeTo}` : ''}` : undefined,
          date: start,
          link: `/udalost/${e.id}`,
          categories: e.categories,
        });
      }
    });

    return items;
  }, [selectedDate, matchResults, tournaments, events]);

  const getTypeColor = (type: CalendarItem['type']): string => {
    switch (type) {
      case 'match':
        return 'bg-primary';
      case 'tournament':
        return 'bg-accent';
      case 'event':
        return 'bg-success';
    }
  };

  const getTypeIcon = (type: CalendarItem['type']) => {
    switch (type) {
      case 'match':
        return <Target className="w-4 h-4 text-primary flex-shrink-0" />;
      case 'tournament':
        return <Trophy className="w-4 h-4 text-accent flex-shrink-0" />;
      case 'event':
        return <CalendarDays className="w-4 h-4 text-success flex-shrink-0" />;
    }
  };

  const getTypeLabel = (type: CalendarItem['type']): string => {
    switch (type) {
      case 'match':
        return 'Zápas';
      case 'tournament':
        return 'Turnaj';
      case 'event':
        return 'Událost';
    }
  };

  return (
    <Card variant="elevated">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-5 h-5 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary">Kalendář</h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="text-text-secondary">Zápasy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          <span className="text-text-secondary">Turnaje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-text-secondary">Události</span>
        </div>
      </div>

      <Calendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        onMonthChange={setCurrentMonth}
        onDayClick={setSelectedDate}
        indicators={indicators}
      />

      {/* Selected day items */}
      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            {format(selectedDate, 'd. MMMM yyyy', { locale: cs })}
          </h3>

          {selectedItems.length === 0 ? (
            <p className="text-sm text-text-muted">Žádné události v tento den</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.link}
                  className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg hover:bg-surface-hover transition-colors border border-border"
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getTypeColor(item.type)}`} />
                  {getTypeIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                    )}
                    {item.categories && item.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.categories.map((cat) => (
                          <span
                            key={cat.id}
                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent"
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-text-muted flex-shrink-0">
                    {getTypeLabel(item.type)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
