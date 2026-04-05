"use client";

import { useState } from "react";

type Props = {
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

export function MatchCard({
  matchId,
  leagueId,
  homeTeam,
  homeFlag,
  awayTeam,
  awayFlag,
  scheduledAt,
  groupName,
  existingHome,
  existingAway,
  isLocked,
  actualHome,
  actualAway,
  pointsEarned,
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
        body: JSON.stringify({ matchId, leagueId, homeScorePred: h, awayScorePred: a }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  const time = new Date(scheduledAt).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const savedAndClean = status === "saved" && !dirty;
  const hasResult = actualHome !== null && actualAway !== null;

  // Points badge styling
  const pointsBadge = pointsEarned !== null
    ? pointsEarned === 3
      ? { label: "+3p", cls: "bg-green-100 text-green-700 border-green-200" }
      : pointsEarned === 1
      ? { label: "+1p", cls: "bg-blue-100 text-blue-700 border-blue-200" }
      : { label: "0p", cls: "bg-secondary text-muted-foreground border-border" }
    : null;

  return (
    <div className={`rounded-xl border bg-card transition-colors ${
      savedAndClean && !isLocked ? "border-green-200 bg-green-50/30" :
      hasResult && pointsEarned === 3 ? "border-green-200 bg-green-50/20" :
      hasResult && pointsEarned === 1 ? "border-blue-200 bg-blue-50/20" :
      "border-border"
    }`}>
      {/* Meta row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-semibold text-primary tracking-wide">
          Grupp {groupName}
        </span>
        <div className="flex items-center gap-2">
          {pointsBadge && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${pointsBadge.cls}`}>
              {pointsBadge.label}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
      </div>

      {/* Teams + score row */}
      <div className="flex items-center px-4 pb-3 gap-2">

        {/* Home team */}
        <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
          <span className="text-sm font-semibold truncate text-right">{homeTeam}</span>
          <span className="text-2xl shrink-0">{homeFlag}</span>
        </div>

        {/* Score inputs */}
        <div className="shrink-0 flex items-center gap-1.5 mx-1">
          {isLocked ? (
            <div className="flex flex-col items-center gap-1">
              {/* Actual result */}
              {hasResult ? (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/5">
                  <span className="text-base font-bold font-mono tabular-nums">
                    {actualHome} – {actualAway}
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-lg bg-muted">
                  <span className="text-xs text-muted-foreground">Pågår</span>
                </div>
              )}
              {/* User's prediction */}
              {hasPrediction && (
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  Ditt tips: {existingHome}–{existingAway}
                </span>
              )}
              {!hasPrediction && isLocked && (
                <span className="text-xs text-muted-foreground">Inget tips</span>
              )}
            </div>
          ) : (
            <>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={home}
                onChange={(e) => { setHome(e.target.value); setStatus("idle"); }}
                onFocus={(e) => e.target.select()}
                className="w-12 h-12 text-center rounded-lg border border-border bg-background text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                placeholder="–"
              />
              <span className="text-muted-foreground font-bold text-lg">–</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={away}
                onChange={(e) => { setAway(e.target.value); setStatus("idle"); }}
                onFocus={(e) => e.target.select()}
                className="w-12 h-12 text-center rounded-lg border border-border bg-background text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                placeholder="–"
              />
            </>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">{awayFlag}</span>
          <span className="text-sm font-semibold truncate">{awayTeam}</span>
        </div>
      </div>

      {/* Save button row */}
      {!isLocked && (
        <div className="px-4 pb-3">
          <button
            onClick={save}
            disabled={status === "saving" || home === "" || away === ""}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              savedAndClean
                ? "bg-green-100 text-green-700 border border-green-200"
                : status === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : home === "" || away === ""
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {status === "saving"
              ? "Sparar..."
              : savedAndClean
              ? "Sparat ✓"
              : status === "error"
              ? "Fel — försök igen"
              : "Spara"}
          </button>
        </div>
      )}
    </div>
  );
}
