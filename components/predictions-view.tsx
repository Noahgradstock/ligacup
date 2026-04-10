"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MatchCard } from "@/components/match-card";
import { useSSE } from "@/hooks/use-sse";
import { computeGroupStandings, StandingsTeam } from "@/lib/predictor/standings";

type MatchRow = {
  matchId: string;
  leagueId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  scheduledAt: string;
  groupName: string;
  savedHome: number | null;
  savedAway: number | null;
  isLocked: boolean;
  actualHome: number | null;
  actualAway: number | null;
  pointsEarned: number | null;
};


function GroupStandings({
  groupMatches,
  predMap,
}: {
  groupMatches: MatchRow[];
  predMap: Map<string, { home: number; away: number }>;
}) {
  const rows = computeGroupStandings(groupMatches, predMap);
  if (rows.length === 0) return null;

  const anyData = rows.some((r: StandingsTeam) => r.played > 0);

  return (
    <div className="mt-6 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/50 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tabell</span>
        {anyData && (
          <span className="text-xs text-muted-foreground italic">Baserad på dina tips</span>
        )}
      </div>
      {!anyData ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Lägg dina tips ovan för att se projicerade placeringar.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium w-full">Lag</th>
              <th className="px-2 py-2 font-medium text-center">S</th>
              <th className="px-2 py-2 font-medium text-center">V</th>
              <th className="px-2 py-2 font-medium text-center">O</th>
              <th className="px-2 py-2 font-medium text-center">F</th>
              <th className="px-2 py-2 font-medium text-center">GM</th>
              <th className="px-2 py-2 font-medium text-center">GD</th>
              <th className="px-3 py-2 font-semibold text-center text-foreground">P</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t: StandingsTeam, i: number) => (
              <tr
                key={t.name}
                className={`border-b border-border last:border-0 transition-colors ${
                  i < 2 ? "bg-primary/5" : ""
                }`}
              >
                <td className="px-4 py-2.5 flex items-center gap-2 font-medium">
                  <span className="text-base leading-none">{t.flag}</span>
                  <span className="truncate">{t.name}</span>
                </td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">{t.played}</td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">{t.won}</td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">{t.drawn}</td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">{t.lost}</td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">{t.gf}–{t.ga}</td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">
                  {t.gf - t.ga > 0 ? `+${t.gf - t.ga}` : t.gf - t.ga}
                </td>
                <td className="px-3 py-2.5 text-center font-bold">{t.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type Props = {
  matches: MatchRow[];
  groups: string[];
  leagueId: string;
};

export function PredictionsView({ matches, groups, leagueId }: Props) {
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState<string>(groups[0] ?? "");

  // Track user's predictions locally so table updates immediately on save
  const [predMap, setPredMap] = useState<Map<string, { home: number; away: number }>>(() => {
    const m = new Map<string, { home: number; away: number }>();
    for (const match of matches) {
      if (match.savedHome !== null && match.savedAway !== null) {
        m.set(match.matchId, { home: match.savedHome, away: match.savedAway });
      }
    }
    return m;
  });

  function handleSave(matchId: string, home: number, away: number) {
    setPredMap((prev) => new Map(prev).set(matchId, { home, away }));
  }

  useSSE({
    url: `/api/events?leagueId=${leagueId}`,
    onMessage: (event) => {
      if (event === "leaderboard_updated") router.refresh();
    },
  });

  const filtered = activeGroup === "Alla matcher"
    ? [...matches].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    : activeGroup === "Alla grupper"
    ? []
    : matches.filter((m) => m.groupName === activeGroup);

  const byDate = new Map<string, MatchRow[]>();
  for (const m of filtered) {
    const key = m.scheduledAt.slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  const tabs = [...groups, "Alla matcher", "Alla grupper"];

  const groupProgress = (group: string) => {
    const groupMatches = matches.filter((m) => m.groupName === group);
    const tipped = groupMatches.filter((m) => predMap.has(m.matchId)).length;
    return { tipped, total: groupMatches.length };
  };

  const isGroupComplete = (group: string) => {
    const { tipped, total } = groupProgress(group);
    return total > 0 && tipped === total;
  };

  // Navigation within groups only
  const activeGroupIndex = groups.indexOf(activeGroup);
  const isOnGroup = activeGroupIndex !== -1;
  const prevGroup = isOnGroup && activeGroupIndex > 0 ? groups[activeGroupIndex - 1] : null;
  const nextGroup = isOnGroup && activeGroupIndex < groups.length - 1 ? groups[activeGroupIndex + 1] : null;
  const isLastGroup = isOnGroup && activeGroupIndex === groups.length - 1;

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-2 sm:flex-wrap sm:overflow-x-visible">
          {tabs.map((g) => {
            const isSpecial = g === "Alla matcher" || g === "Alla grupper";
            const complete = !isSpecial && isGroupComplete(g);
            const active = activeGroup === g;
            const progress = !isSpecial ? groupProgress(g) : null;
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? complete
                      ? "bg-green-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : complete
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {isSpecial ? g : `Grupp ${g}`}
                {!isSpecial && progress && !complete && progress.tipped > 0 && (
                  <span className="ml-1 text-xs opacity-70">{progress.tipped}/{progress.total}</span>
                )}
                {complete && <span className="ml-1 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Matches */}
      <div className="flex flex-col gap-3 pt-4">
        {activeGroup === "Alla matcher" ? (
          Array.from(byDate.entries()).map(([dateKey, dayMatches]) => {
            const label = new Date(dateKey + "T12:00:00").toLocaleDateString("sv-SE", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            return (
              <div key={dateKey} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-2">
                  {label}
                </p>
                {dayMatches.map((m) => (
                  <MatchCard key={m.matchId} matchId={m.matchId} leagueId={leagueId} homeTeam={m.homeTeam} homeFlag={m.homeFlag} awayTeam={m.awayTeam} awayFlag={m.awayFlag} scheduledAt={m.scheduledAt} groupName={`Grupp ${m.groupName}`} savedHome={predMap.get(m.matchId)?.home ?? null} savedAway={predMap.get(m.matchId)?.away ?? null} isLocked={m.isLocked} actualHome={m.actualHome} actualAway={m.actualAway} pointsEarned={m.pointsEarned} onSave={handleSave} />
                ))}
              </div>
            );
          })
        ) : activeGroup === "Alla grupper" ? (
          groups.map((g) => {
            const groupMatches = matches.filter((m) => m.groupName === g);
            return (
              <div key={g} className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-4 first:pt-0">
                  Grupp {g}
                </p>
                <GroupStandings groupMatches={groupMatches} predMap={predMap} />
              </div>
            );
          })
        ) : (
          <>
            {filtered.map((m) => (
              <MatchCard key={m.matchId} matchId={m.matchId} leagueId={leagueId} homeTeam={m.homeTeam} homeFlag={m.homeFlag} awayTeam={m.awayTeam} awayFlag={m.awayFlag} scheduledAt={m.scheduledAt} groupName={`Grupp ${m.groupName}`} savedHome={predMap.get(m.matchId)?.home ?? null} savedAway={predMap.get(m.matchId)?.away ?? null} isLocked={m.isLocked} actualHome={m.actualHome} actualAway={m.actualAway} pointsEarned={m.pointsEarned} onSave={handleSave} />
            ))}
            {filtered.length > 0 && (
              <GroupStandings groupMatches={filtered} predMap={predMap} />
            )}
            {/* Group navigation */}
            {isOnGroup && (
              <div className="flex items-center justify-between gap-3 pt-2 pb-4">
                {prevGroup ? (
                  <button
                    onClick={() => { setActiveGroup(prevGroup); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60 transition-colors"
                  >
                    ← Grupp {prevGroup}
                  </button>
                ) : (
                  <div />
                )}
                {isLastGroup ? (
                  <a
                    href={`/league/${leagueId}/bracket`}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Slutspel →
                  </a>
                ) : nextGroup ? (
                  <button
                    onClick={() => { setActiveGroup(nextGroup); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60 transition-colors"
                  >
                    Grupp {nextGroup} →
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
