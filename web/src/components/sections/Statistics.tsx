'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronLeft, ChevronRight, Trophy, Target, Users, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import type { PlayerHighlight, Standing } from '@/lib/types';
import TeamLogo from '../ui/TeamLogo';
import SectionHeader from '../ui/SectionHeader';
import FilterSelect from '../ui/FilterSelect';
import { formatSeason } from '@/lib/season';
import { isCupCompetition } from '@/lib/competition';

const MAX_VISIBLE_ROWS = 8;

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!isInView) return;

    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <span ref={ref} className="number-display">
      {count}{suffix}
    </span>
  );
}

interface StatisticsProps {
  standings: Standing[];
  playerHighlights: PlayerHighlight[];
  playerCount: number;
}

function isOurTeamRow(row: Standing): boolean {
  return row.teamName.toLowerCase().includes('frýdek');
}

interface CompetitionGroup {
  code: string;
  tournamentName: string | null;
  rows: Standing[];
  hasOurTeam: boolean;
  isCup: boolean;
}

export default function Statistics({ standings, playerHighlights, playerCount }: StatisticsProps) {
  const [showAll, setShowAll] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  // Seasons with standings data, newest first. Default = newest with data.
  const seasons = useMemo(() => {
    const unique = new Set(standings.map((s) => s.season));
    return [...unique].sort((a, b) => b - a);
  }, [standings]);

  const activeSeason = selectedSeason !== null && seasons.includes(selectedSeason)
    ? selectedSeason
    : seasons[0] ?? null;

  // A category can have several competitions per season (e.g. main league +
  // nadstavba) — group rows by competition so tables don't interleave.
  const groups = useMemo<CompetitionGroup[]>(() => {
    const byCode = new Map<string, Standing[]>();
    for (const row of standings) {
      if (row.season !== activeSeason) continue;
      const rows = byCode.get(row.competitionCode) ?? [];
      rows.push(row);
      byCode.set(row.competitionCode, rows);
    }
    return [...byCode.entries()]
      .map(([code, rows]) => ({
        code,
        tournamentName: rows[0]?.tournamentName ?? null,
        rows: [...rows].sort((a, b) => a.position - b.position),
        hasOurTeam: rows.some(isOurTeamRow),
        isCup: isCupCompetition(code, rows[0]?.tournamentName ?? null),
      }))
      .sort((a, b) => {
        if (a.hasOurTeam !== b.hasOurTeam) return a.hasOurTeam ? -1 : 1;
        // League before cup: a 62-team cup round would otherwise outrank the
        // league table on row count, especially early in the season.
        if (a.isCup !== b.isCup) return a.isCup ? 1 : -1;
        return b.rows.length - a.rows.length;
      });
  }, [standings, activeSeason]);

  const activeGroup = groups.find((g) => g.code === selectedCode) ?? groups[0];
  // Stats cards always describe our team's primary competition of the season
  const primaryGroup = groups.find((g) => g.hasOurTeam);
  const ourTeam = primaryGroup?.rows.find(isOurTeamRow);

  if (standings.length === 0 || activeSeason === null) return null;
  if (!activeGroup || !ourTeam) return null;

  const tournamentName = primaryGroup?.tournamentName ?? null;
  const tableRows = activeGroup.rows;

  const ourTeamIndex = tableRows.findIndex(isOurTeamRow);
  const needsTruncation = tableRows.length > MAX_VISIBLE_ROWS;

  let visibleStandings: Standing[];
  if (showAll || !needsTruncation) {
    visibleStandings = tableRows;
  } else if (ourTeamIndex < 0 || ourTeamIndex < MAX_VISIBLE_ROWS) {
    visibleStandings = tableRows.slice(0, MAX_VISIBLE_ROWS);
  } else {
    visibleStandings = [...tableRows.slice(0, MAX_VISIBLE_ROWS - 1), tableRows[ourTeamIndex]];
  }

  const seasonLabel = `v sezóně ${formatSeason(activeSeason)}`;

  const seasonStats = [
    {
      label: 'Pozice v tabulce',
      value: ourTeam.position,
      suffix: '.',
      icon: Trophy,
      description: tournamentName ?? 'Tabulka',
    },
    {
      label: 'Odehraných zápasů',
      value: ourTeam.matchesPlayed,
      icon: Target,
      description: seasonLabel,
    },
    {
      label: 'Vstřelených gólů',
      value: ourTeam.goalsFor,
      icon: TrendingUp,
      description: seasonLabel,
    },
    {
      label: 'Hráčů v kádru',
      value: playerCount,
      icon: Users,
      description: 'aktivních hráčů',
    },
  ];

  const currentHighlight = playerHighlights.length > 0 ? playerHighlights[highlightIndex] : null;
  const hasMultipleHighlights = playerHighlights.length > 1;

  const prevHighlight = () => {
    setHighlightIndex((i) => (i - 1 + playerHighlights.length) % playerHighlights.length);
  };
  const nextHighlight = () => {
    setHighlightIndex((i) => (i + 1) % playerHighlights.length);
  };

  return (
    <section className="py-section bg-surface-light">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Season Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-section text-primary uppercase mb-4">
            Sezóna v číslech
          </h2>
          <p className="text-body-lg text-primary/60 max-w-xl mx-auto">
            Statistiky v {tournamentName ?? 'soutěži'} {seasonLabel}
          </p>
          {seasons.length > 1 && (
            <div className="mt-6 flex justify-center">
              <FilterSelect
                label="Sezóna"
                value={String(activeSeason)}
                options={seasons.map((s) => ({ value: String(s), label: formatSeason(s) }))}
                onChange={(value) => {
                  setSelectedSeason(Number(value));
                  setSelectedCode(null);
                  setShowAll(false);
                }}
              />
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-12">
          {seasonStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group"
            >
              <div className="bg-white p-6 lg:p-8 text-center h-full transition-all duration-300 hover:bg-primary hover:shadow-card-hover group-hover:-translate-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 text-accent mb-4 transition-colors group-hover:bg-white/10 group-hover:text-white">
                  <stat.icon className="w-7 h-7" />
                </div>
                <div className="text-4xl lg:text-5xl font-black text-primary mb-2 transition-colors group-hover:text-white">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <h3 className="text-sm lg:text-base font-semibold text-primary uppercase tracking-wide mb-1 transition-colors group-hover:text-white">
                  {stat.label}
                </h3>
                <p className="text-small text-primary/50 transition-colors group-hover:text-white/60">
                  {stat.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Player Highlight + Standings Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Player Highlight */}
          {currentHighlight && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              {/* Mobile: stacked layout, Desktop: side by side */}
              <div className="flex items-end gap-4 sm:gap-6">
                {/* Player Image */}
                <div className="relative w-32 h-44 sm:w-48 sm:h-64 shrink-0">
                  <Image
                    src={currentHighlight.playerPhoto?.url ?? '/player-placeholder.png'}
                    alt={currentHighlight.playerName}
                    fill
                    className="object-cover object-top"
                  />
                </div>

                {/* Player Name + Highlight Stat */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm sm:text-base font-bold text-primary">
                      {currentHighlight.title}
                    </h3>
                    {hasMultipleHighlights && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={prevHighlight}
                          className="p-1 text-primary/40 hover:text-primary transition-colors"
                          aria-label="Předchozí"
                        >
                          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={nextHighlight}
                          className="p-1 text-primary/40 hover:text-primary transition-colors"
                          aria-label="Další"
                        >
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-primary/60 text-base sm:text-lg">{currentHighlight.playerFirstName}</p>
                  <p className="text-primary text-2xl sm:text-3xl font-black uppercase leading-tight mb-3 sm:mb-4">
                    {currentHighlight.playerLastName}
                  </p>

                  <div className="inline-flex items-center mb-4 sm:mb-6">
                    <div className="bg-accent px-3 py-1.5 min-w-[3rem] text-center border-r-4 border-primary">
                      <span className="text-xl sm:text-2xl font-black text-white">{currentHighlight.highlightStat.value}</span>
                    </div>
                    <span className="text-xs sm:text-sm text-primary/70 font-medium ml-3">{currentHighlight.highlightStat.label}</span>
                  </div>

                  {/* Stats - hidden on mobile, shown inline on sm+ */}
                  <div className="hidden sm:block space-y-1">
                    {currentHighlight.stats.map((stat) => (
                      <div key={stat.label} className="flex items-center">
                        <div className="bg-primary px-3 py-1.5 min-w-[3rem] text-center border-r-4 border-accent">
                          <span className="text-lg font-black text-white">{stat.value}</span>
                        </div>
                        <span className="text-sm text-primary/70 font-medium ml-3">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stats - mobile only, full width below */}
              <div className="sm:hidden mt-6 ml-4 space-y-2">
                {currentHighlight.stats.map((stat) => (
                  <div key={stat.label} className="flex items-center">
                    <div className="bg-primary px-4 py-2 min-w-[4rem] text-center border-r-4 border-accent">
                      <span className="text-xl font-black text-white">{stat.value}</span>
                    </div>
                    <span className="text-base text-primary/70 font-medium ml-4">{stat.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Spacer after highlight on mobile */}
          {currentHighlight && <div className="lg:hidden h-8" />}

          {/* Right: Standings Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={!currentHighlight ? 'lg:col-span-2' : ''}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <SectionHeader
                title={activeGroup.tournamentName ?? 'Tabulka'}
                icon={Trophy}
              />
              {groups.length > 1 && (
                <FilterSelect
                  label="Soutěž"
                  value={activeGroup.code}
                  options={groups.map((g) => ({ value: g.code, label: g.tournamentName ?? g.code }))}
                  onChange={(value) => {
                    setSelectedCode(value);
                    setShowAll(false);
                  }}
                  className="shrink-0"
                />
              )}
            </div>

            <div className="bg-primary overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider">
                    <th className="px-3 py-3 text-left">#</th>
                    <th className="px-3 py-3 text-left">Tým</th>
                    <th className="px-3 py-3 text-center">Z</th>
                    <th className="px-3 py-3 text-center hidden sm:table-cell">V</th>
                    <th className="px-3 py-3 text-center hidden sm:table-cell">R</th>
                    <th className="px-3 py-3 text-center hidden sm:table-cell">P</th>
                    <th className="px-3 py-3 text-center hidden sm:table-cell">Skóre</th>
                    <th className="px-3 py-3 text-center">B</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {visibleStandings.map((row, index) => {
                    const isOurTeam = row.teamName.toLowerCase().includes('frýdek');
                    const isGapRow = !showAll && needsTruncation && ourTeamIndex >= MAX_VISIBLE_ROWS && index === MAX_VISIBLE_ROWS - 1;
                    return (
                      <tr
                        key={`${row.position}-${row.teamName}`}
                        className={`border-t border-white/10 ${isOurTeam ? 'bg-accent/20' : ''} ${isGapRow ? 'border-t-2 border-t-white/20 border-dashed' : ''}`}
                      >
                        <td className={`px-3 py-3 ${isOurTeam ? 'text-accent font-bold' : 'text-white/60'}`}>
                          {row.position}.
                        </td>
                        <td className={`px-3 py-3 ${isOurTeam ? 'font-bold text-accent' : 'font-medium'}`}>
                          <div className="flex items-center gap-2">
                            {row.teamLogo && (
                              <TeamLogo
                                name={row.teamName}
                                logo={row.teamLogo}
                                size={20}
                                className="w-5 h-5 shrink-0"
                              />
                            )}
                            {row.teamName}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">{row.matchesPlayed}</td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">{row.wins}</td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">{row.draws}</td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">{row.losses}</td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          {row.goalsFor}:{row.goalsAgainst}
                        </td>
                        <td className="px-3 py-3 text-center font-bold">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {needsTruncation && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-3 text-sm text-primary/60 hover:text-primary transition-colors font-medium"
              >
                {showAll ? 'Skrýt tabulku' : 'Zobrazit celou tabulku'}
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
