"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MatchCard } from "@/components/match-card";
import { useSSE } from "@/hooks/use-sse";

type MatchRow = {
  matchId: string;
  leagueId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  scheduledAt: string;
  groupName: string;
  existingHome: number | null;
  existingAway: number | null;
  isLocked: boolean;
  actualHome: number | null;
  actualAway: number | null;
  pointsEarned: number | null;
};

type TeamRow = {
  name: string;
  flag: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
};

function computeStandings(groupMatches: MatchRow[]): TeamRow[] {
  const map = new Map<string, TeamRow>();

  // Register all teams first (alphabetical seed)
  for (const m of groupMatches) {
    if (!map.has(m.homeTeam))
      map.set(m.homeTeam, { name: m.homeTeam, flag: m.homeFlag, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 });
    if (!map.has(m.awayTeam))
      map.set(m.awayTeam, { name: m.awayTeam, flag: m.awayFlag, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 });
  }

  // Apply confirmed results
  for (const m of groupMatches) {
    if (m.actualHome === null || m.actualAway === null) continue;
    const home = map.get(m.homeTeam)!;
    const away = map.get(m.awayTeam)!;
    home.played++;
    away.played++;
    home.gf += m.actualHome;
    home.ga += m.actualAway;
    away.gf += m.actualAway;
    away.ga += m.actualHome;
    if (m.actualHome > m.actualAway) {
      home.won++; home.pts += 3; away.lost++;
    } else if (m.actualHome < m.actualAway) {
      away.won++; away.pts += 3; home.lost++;
    } else {
      home.drawn++; home.pts += 1; away.drawn++; away.pts += 1;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
}

function GroupStandings({ groupMatches }: { groupMatches: MatchRow[] }) {
  const rows = computeStandings(groupMatches);
  if (rows.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/50 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tabell</span>
      </div>
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
          {rows.map((t, i) => (
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
    </div>
  );
}

type Props = {
  matches: MatchRow[];
  groups: string[]; // e.g. ["A","B","C","D","E","F","G","H"]
  leagueId: string;
};

export function PredictionsView({ matches, groups, leagueId }: Props) {
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState<string>(groups[0] ?? "");

  useSSE({
    url: `/api/events?leagueId=${leagueId}`,
    onMessage: (event) => {
      if (event === "leaderboard_updated") router.refresh();
    },
  });

  const filtered = activeGroup === "Alla"
    ? [...matches].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    : matches.filter((m) => m.groupName === activeGroup);

  // Group filtered matches by date for the "Alla" view
  const byDate = new Map<string, MatchRow[]>();
  for (const m of filtered) {
    const key = m.scheduledAt.slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  const tabs = [...groups, "Alla"];

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-2">
          {tabs.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeGroup === g
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {g === "Alla" ? "Alla" : `Grupp ${g}`}
            </button>
          ))}
        </div>
      </div>

      {/* Matches */}
      <div className="flex flex-col gap-3 pt-4">
        {activeGroup === "Alla" ? (
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
                  <MatchCard key={m.matchId} {...m} leagueId={leagueId} />
                ))}
              </div>
            );
          })
        ) : (
          <>
            {filtered.map((m) => (
              <MatchCard key={m.matchId} {...m} leagueId={leagueId} />
            ))}
            {filtered.length > 0 && (
              <GroupStandings groupMatches={filtered} />
            )}
          </>
        )}

        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Inga matcher i Grupp {activeGroup}.
          </p>
        )}
      </div>
    </div>
  );
}
