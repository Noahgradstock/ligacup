"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  matchId: string;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  scheduledAt: string; // ISO string
  groupName: string;
  existingHome: number | null;
  existingAway: number | null;
  isLocked: boolean;
};

export function MatchCard({
  matchId,
  homeTeam,
  homeFlag,
  awayTeam,
  awayFlag,
  scheduledAt,
  groupName,
  existingHome,
  existingAway,
  isLocked,
}: Props) {
  const [home, setHome] = useState(existingHome?.toString() ?? "");
  const [away, setAway] = useState(existingAway?.toString() ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    existingHome !== null ? "saved" : "idle"
  );

  const hasPrediction = existingHome !== null;
  const dirty =
    home !== (existingHome?.toString() ?? "") ||
    away !== (existingAway?.toString() ?? "");

  async function save() {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;

    setStatus("saving");
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, homeScorePred: h, awayScorePred: a }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  const dateLabel = new Date(scheduledAt).toLocaleDateString("sv-SE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors">
      {/* Group + time */}
      <div className="hidden sm:flex flex-col items-center w-16 shrink-0 text-center">
        <span className="text-xs font-semibold text-primary">Grupp {groupName}</span>
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
      </div>

      {/* Home team */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className="text-sm font-medium truncate">{homeTeam}</span>
        <span className="text-xl">{homeFlag}</span>
      </div>

      {/* Score inputs */}
      <div className="flex items-center gap-1 shrink-0">
        {isLocked ? (
          <div className="flex items-center gap-1 px-3 py-1 rounded bg-muted text-muted-foreground text-sm font-mono">
            {hasPrediction ? (
              <span>{existingHome} – {existingAway}</span>
            ) : (
              <span className="text-xs">Låst</span>
            )}
          </div>
        ) : (
          <>
            <input
              type="number"
              min={0}
              max={99}
              value={home}
              onChange={(e) => { setHome(e.target.value); setStatus("idle"); }}
              className="w-10 text-center rounded border border-border bg-background py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="–"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <input
              type="number"
              min={0}
              max={99}
              value={away}
              onChange={(e) => { setAway(e.target.value); setStatus("idle"); }}
              className="w-10 text-center rounded border border-border bg-background py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="–"
            />
          </>
        )}
      </div>

      {/* Away team */}
      <div className="flex items-center gap-2 flex-1">
        <span className="text-xl">{awayFlag}</span>
        <span className="text-sm font-medium truncate">{awayTeam}</span>
      </div>

      {/* Save button */}
      <div className="w-20 shrink-0 flex justify-end">
        {isLocked ? null : (
          <Button
            size="sm"
            variant={status === "saved" && !dirty ? "outline" : "default"}
            disabled={status === "saving" || home === "" || away === ""}
            onClick={save}
            className="text-xs px-3"
          >
            {status === "saving"
              ? "..."
              : status === "saved" && !dirty
              ? "Sparat ✓"
              : status === "error"
              ? "Fel!"
              : "Spara"}
          </Button>
        )}
      </div>
    </div>
  );
}
