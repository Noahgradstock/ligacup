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

type MemberPrediction = {
  displayName: string;
  homeScorePred: number;
  awayScorePred: number;
  pointsEarned: number | null;
  isCurrentUser: boolean;
};

function pointsBadgeStyle(pts: number | null) {
  if (pts === null) return null;
  if (pts === 3) return { label: "+3p", cls: "bg-green-100 text-green-700 border-green-200" };
  if (pts === 1) return { label: "+1p", cls: "bg-blue-100 text-blue-700 border-blue-200" };
  return { label: "0p", cls: "bg-secondary text-muted-foreground border-border" };
}

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
  const [showOthers, setShowOthers] = useState(false);
  const [others, setOthers] = useState<MemberPrediction[] | null>(null);
  const [loadingOthers, setLoadingOthers] = useState(false);

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

  async function toggleOthers() {
    if (showOthers) {
      setShowOthers(false);
      return;
    }
    setShowOthers(true);
    if (others !== null) return; // already loaded
    setLoadingOthers(true);
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/match-predictions?matchId=${matchId}`
      );
      if (res.ok) {
        const data = await res.json();
        setOthers(data.predictions);
      }
    } finally {
      setLoadingOthers(false);
    }
  }

  const time = new Date(scheduledAt).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const savedAndClean = status === "saved" && !dirty;
  const hasResult = actualHome !== null && actualAway !== null;
  const myBadge = pointsBadgeStyle(pointsEarned);

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
          {myBadge && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${myBadge.cls}`}>
              {myBadge.label}
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
              {hasPrediction && (
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  Ditt tips: {existingHome}–{existingAway}
                </span>
              )}
              {!hasPrediction && (
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

      {/* Show others' predictions (locked matches only) */}
      {isLocked && (
        <div className="border-t border-border">
          <button
            onClick={toggleOthers}
            className="w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors flex items-center justify-between"
          >
            <span>Visa alla tips</span>
            <span className="text-base leading-none">{showOthers ? "−" : "+"}</span>
          </button>

          {showOthers && (
            <div className="px-4 pb-3 flex flex-col gap-1.5">
              {loadingOthers && (
                <p className="text-xs text-muted-foreground py-2 text-center">Laddar...</p>
              )}
              {!loadingOthers && others && others.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  Inga tips lagda.
                </p>
              )}
              {!loadingOthers && others && others.map((p, i) => {
                const badge = pointsBadgeStyle(p.pointsEarned);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      p.isCurrentUser ? "bg-primary/5 border border-primary/15" : "bg-secondary/40"
                    }`}
                  >
                    <span className={`text-xs font-medium truncate max-w-[120px] ${p.isCurrentUser ? "text-primary" : ""}`}>
                      {p.displayName}{p.isCurrentUser && " (du)"}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono tabular-nums text-foreground">
                        {p.homeScorePred}–{p.awayScorePred}
                      </span>
                      {badge ? (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground w-8 text-right">–</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
