'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Plus, Trophy, CalendarDays, Target, ArrowRight } from 'lucide-react';
import { MatchResult } from '@/types/match-result';
import { Tournament } from '@/types/tournament';
import { Event } from '@/types/event';

interface DashboardData {
  matchResults: MatchResult[];
  tournaments: Tournament[];
  events: Event[];
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [mrRes, tRes, eRes] = await Promise.all([
          fetch('/api/match-results/list'),
          fetch('/api/tournaments/list'),
          fetch('/api/events/list'),
        ]);

        const [mrData, tData, eData] = await Promise.all([
          mrRes.json(),
          tRes.json(),
          eRes.json(),
        ]);

        setData({
          matchResults: (mrData.matchResults || []).slice(0, 3),
          tournaments: (tData.tournaments || []).slice(0, 3),
          events: (eData.events || []).slice(0, 3),
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (userLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            Vítejte, {user.firstName}!
          </h1>
          <p className="text-text-secondary">
            Zde je přehled nejnovějších aktivit
          </p>
        </div>

        {/* Fast Links */}
        <div className="flex gap-3">
          <Link
            href="/zadat-vysledek"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            title="Přidat výsledek"
          >
            <Plus className="w-5 h-5" />
            Výsledek
          </Link>
          <Link
            href="/nova-udalost"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            title="Přidat událost"
          >
            <Plus className="w-5 h-5" />
            Událost
          </Link>
          <Link
            href="/novy-turnaj"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            title="Přidat turnaj"
          >
            <Plus className="w-5 h-5" />
            Turnaj
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3 items-start">
            {/* Recent Match Results */}
            <Card variant="elevated">
              <div className="flex items-center justify-between mb-4">
                <Link href="/vysledky" className="text-lg font-semibold text-text-primary flex items-center gap-2 hover:text-primary transition-colors">
                  <Target className="w-5 h-5 text-primary" />
                  Nejnovější výsledky
                </Link>
                <div className="flex items-center gap-3">
                  <Link href="/zadat-vysledek" className="p-1.5 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors" title="Nový výsledek">
                    <Plus className="w-4 h-4 text-primary" />
                  </Link>
                  <Link href="/vysledky" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Vše <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
              {data?.matchResults.length === 0 ? (
                <p className="text-text-muted text-sm">Žádné výsledky</p>
              ) : (
                <div className="space-y-4">
                  {data?.matchResults.map((mr) => (
                    <Link key={mr.id} href={`/vysledek/${mr.id}`} className="block">
                      <div className="p-3 bg-surface-elevated rounded-lg hover:bg-surface-hover transition-colors border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent">
                            {mr.category}
                          </span>
                          <span className="text-xs text-text-muted">
                            {new Date(mr.matchDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-text-primary truncate flex-1 text-right">
                            {mr.homeTeam}
                          </span>
                          <span className="px-3 py-1 bg-primary/20 text-primary font-bold rounded-md whitespace-nowrap text-lg">
                            {mr.homeScore}:{mr.awayScore}
                          </span>
                          <span className="text-sm font-medium text-text-primary truncate flex-1">
                            {mr.awayTeam}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Tournaments */}
            <Card variant="elevated">
              <div className="flex items-center justify-between mb-4">
                <Link href="/turnaje" className="text-lg font-semibold text-text-primary flex items-center gap-2 hover:text-primary transition-colors">
                  <Trophy className="w-5 h-5 text-accent" />
                  Nejnovější turnaje
                </Link>
                <div className="flex items-center gap-3">
                  <Link href="/novy-turnaj" className="p-1.5 bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors" title="Nový turnaj">
                    <Plus className="w-4 h-4 text-accent" />
                  </Link>
                  <Link href="/turnaje" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Vše <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
              {data?.tournaments.length === 0 ? (
                <p className="text-text-muted text-sm">Žádné turnaje</p>
              ) : (
                <div className="space-y-4">
                  {data?.tournaments.map((t) => (
                    <Link key={t.id} href={`/turnaj/${t.id}`} className="block">
                      <div className="p-3 bg-surface-elevated rounded-lg hover:bg-surface-hover transition-colors border border-border">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {t.name}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {new Date(t.dateFrom).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Events */}
            <Card variant="elevated">
              <div className="flex items-center justify-between mb-4">
                <Link href="/udalosti" className="text-lg font-semibold text-text-primary flex items-center gap-2 hover:text-primary transition-colors">
                  <CalendarDays className="w-5 h-5 text-success" />
                  Nejnovější události
                </Link>
                <div className="flex items-center gap-3">
                  <Link href="/nova-udalost" className="p-1.5 bg-success/10 rounded-lg hover:bg-success/20 transition-colors" title="Nová událost">
                    <Plus className="w-4 h-4 text-success" />
                  </Link>
                  <Link href="/udalosti" className="text-sm text-primary hover:underline flex items-center gap-1">
                    Vše <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
              {data?.events.length === 0 ? (
                <p className="text-text-muted text-sm">Žádné události</p>
              ) : (
                <div className="space-y-4">
                  {data?.events.map((e) => (
                    <Link key={e.id} href={`/udalost/${e.id}`} className="block">
                      <div className="p-3 bg-surface-elevated rounded-lg hover:bg-surface-hover transition-colors border border-border">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {e.name}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {new Date(e.dateFrom).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
