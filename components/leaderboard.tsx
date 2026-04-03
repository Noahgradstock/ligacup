"use client";

import { useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { LeaderboardEntry } from "@/app/api/leagues/[id]/leaderboard/route";

type Props = {
  leagueId: string;
  currentUserId: string | null;
  initial: LeaderboardEntry[];
};

export function Leaderboard({ leagueId, currentUserId, initial }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial);
  const [flash, setFlash] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/leaderboard`);
      if (res.ok) {
        setEntries(await res.json());
        setFlash(true);
        setTimeout(() => setFlash(false), 1500);
      }
    } catch {
      // silently ignore — stale data is fine
    }
  }, [leagueId]);

  useSSE({
    url: `/api/events?leagueId=${leagueId}`,
    onMessage: (event) => {
      if (event === "leaderboard_updated") refetch();
    },
  });

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground text-sm">
        Inga poäng ännu. Poäng beräknas när matchresultat bekräftas.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 transition-opacity ${flash ? "opacity-70" : "opacity-100"}`}>
      {entries.map((entry, i) => {
        const isMe = entry.userId === currentUserId;
        const label = entry.displayName ?? entry.email.split("@")[0];
        return (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
              isMe ? "border-primary/30 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <span className="w-6 text-center text-sm font-bold text-muted-foreground">
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-medium">
              {label}
              {isMe && <span className="ml-2 text-xs text-primary">(du)</span>}
            </span>
            <span className="text-sm font-bold tabular-nums">{entry.totalPoints}p</span>
          </div>
        );
      })}
    </div>
  );
}
