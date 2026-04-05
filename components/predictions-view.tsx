"use client";

import { useState } from "react";
import { MatchCard } from "@/components/match-card";

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
};

type Props = {
  matches: MatchRow[];
  groups: string[]; // e.g. ["A","B","C","D","E","F","G","H"]
  leagueId: string;
};

export function PredictionsView({ matches, groups, leagueId }: Props) {
  const [activeGroup, setActiveGroup] = useState<string>(groups[0] ?? "");

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
          filtered.map((m) => (
            <MatchCard key={m.matchId} {...m} leagueId={leagueId} />
          ))
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
