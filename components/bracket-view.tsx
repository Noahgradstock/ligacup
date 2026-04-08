"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MatchCard } from "@/components/match-card";

type BracketMatch = {
  matchId: string;
  leagueId: string;
  roundType: string;
  roundName: string;
  matchNumber: number;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  scheduledAt: string;
  existingHome: number | null;
  existingAway: number | null;
  isLocked: boolean;
  actualHome: number | null;
  actualAway: number | null;
  pointsEarned: number | null;
  isTbd: boolean;
};

type RoundMeta = {
  roundType: string;
  roundName: string;
};

type Props = {
  matches: BracketMatch[];
  rounds: RoundMeta[];
  leagueId: string;
};

// Compact labels for the bracket overview column headers (space is tight)
const ROUND_COMPACT: Record<string, string> = {
  ROUND_OF_32: "Åttondels",
  ROUND_OF_16: "Sextondels",
  QF: "Kvartsfinal",
  SF: "Semifinal",
  FINAL: "Final",
};

export function BracketView({ matches, rounds, leagueId }: Props) {
  const router = useRouter();
  const [activeRound, setActiveRound] = useState<string>(rounds[0]?.roundType ?? "");
  const [predMap, setPredMap] = useState<Map<string, { home: number; away: number }>>(() => {
    const m = new Map<string, { home: number; away: number }>();
    for (const match of matches) {
      if (match.existingHome !== null && match.existingAway !== null) {
        m.set(match.matchId, { home: match.existingHome, away: match.existingAway });
      }
    }
    return m;
  });

  function handleSave(matchId: string, home: number, away: number) {
    setPredMap((prev) => new Map(prev).set(matchId, { home, away }));
    router.refresh();
  }

  const activeMatches = matches.filter((m) => m.roundType === activeRound);
  const activeRoundMeta = rounds.find((r) => r.roundType === activeRound);

  // Count tips per round for badge
  const tipsByRound = new Map<string, number>();
  for (const r of rounds) {
    const roundMatches = matches.filter((m) => m.roundType === r.roundType);
    const tipped = roundMatches.filter(
      (m) => predMap.has(m.matchId) || m.existingHome !== null
    ).length;
    tipsByRound.set(r.roundType, tipped);
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-2">
          {rounds.map((r) => {
            const total = matches.filter((m) => m.roundType === r.roundType).length;
            const tipped = tipsByRound.get(r.roundType) ?? 0;
            const allTipped = tipped === total && total > 0;
            return (
              <button
                key={r.roundType}
                onClick={() => setActiveRound(r.roundType)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeRound === r.roundType
                    ? allTipped
                      ? "bg-green-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : allTipped
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {r.roundName}
                {allTipped && (
                  <span className="text-xs leading-none">✓</span>
                )}
                {!allTipped && tipped > 0 && activeRound !== r.roundType && (
                  <span className="text-xs leading-none opacity-70">{tipped}/{total}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Round header */}
      {activeRoundMeta && (
        <div className="pt-4 pb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {activeRoundMeta.roundName}
          </p>
        </div>
      )}

      {/* TBD notice */}
      {activeMatches.some((m) => m.isTbd) && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground">
            {activeRound === "ROUND_OF_32"
              ? "Lag är ännu inte klara — tippa vilket resultat du tror. Namnen uppdateras när gruppspelet är klart."
              : activeRound === "ROUND_OF_16"
              ? "Tippa klart åttondelsfinalerna för att se vilka lag som möts."
              : activeRound === "QF"
              ? "Tippa klart sextondelsfinalen för att se vilka lag som möts."
              : activeRound === "SF"
              ? "Tippa klart kvartsfinalen för att se vilka lag som möts."
              : "Tippa klart semifinalen för att se vilka lag som möts."}
          </p>
        </div>
      )}

      {/* Match cards */}
      <div className="flex flex-col gap-3">
        {activeMatches.map((m) => (
          <MatchCard
            key={m.matchId}
            matchId={m.matchId}
            leagueId={leagueId}
            homeTeam={m.homeTeam}
            homeFlag={m.homeFlag}
            awayTeam={m.awayTeam}
            awayFlag={m.awayFlag}
            scheduledAt={m.scheduledAt}
            groupName={m.roundName}
            existingHome={m.existingHome}
            existingAway={m.existingAway}
            isLocked={m.isLocked}
            actualHome={m.actualHome}
            actualAway={m.actualAway}
            pointsEarned={m.pointsEarned}
            onSave={handleSave}
          />
        ))}
        {activeMatches.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Inga matcher i den här rundan.
          </p>
        )}
      </div>

      {/* Bracket overview (mini) */}
      <BracketOverview matches={matches} rounds={rounds} activeRound={activeRound} onSelectRound={setActiveRound} predMap={predMap} />
    </div>
  );
}

function BracketOverview({
  matches,
  rounds,
  activeRound,
  onSelectRound,
  predMap,
}: {
  matches: BracketMatch[];
  rounds: RoundMeta[];
  activeRound: string;
  onSelectRound: (r: string) => void;
  predMap: Map<string, { home: number; away: number }>;
}) {
  // Only show if we have at least R16 and QF
  if (rounds.length < 2) return null;

  return (
    <div className="mt-6 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/50 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Bracket-översikt</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-0 min-w-max p-3">
          {rounds.map((r, ri) => {
            const roundMatches = matches.filter((m) => m.roundType === r.roundType);
            return (
              <div key={r.roundType} className="flex items-center">
                <div className="flex flex-col gap-2 min-w-[110px] px-1">
                  <p className="text-[10px] font-semibold text-center text-muted-foreground uppercase tracking-wide mb-1">
                    {ROUND_COMPACT[r.roundType] ?? r.roundName}
                  </p>
                  {roundMatches.map((m) => {
                    const pred = predMap.get(m.matchId);
                    const hasPred = pred !== undefined || m.existingHome !== null;
                    const isActive = r.roundType === activeRound;
                    return (
                      <button
                        key={m.matchId}
                        onClick={() => onSelectRound(r.roundType)}
                        className={`w-full px-2 py-1.5 rounded-lg border text-left transition-colors ${
                          isActive
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-background hover:bg-secondary/40"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[11px] leading-tight text-foreground">
                          <span className="text-sm leading-none">{m.homeFlag}</span>
                          <span className="truncate max-w-[50px] font-medium">{m.homeTeam}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] leading-tight mt-0.5 text-foreground">
                          <span className="text-sm leading-none">{m.awayFlag}</span>
                          <span className="truncate max-w-[50px] font-medium">{m.awayTeam}</span>
                        </div>
                        {hasPred && (
                          <div className="mt-1 text-[10px] text-muted-foreground font-mono tabular-nums">
                            {pred?.home ?? m.existingHome}–{pred?.away ?? m.existingAway}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {ri < rounds.length - 1 && (
                  <div className="flex flex-col items-center justify-center self-stretch px-1">
                    <span className="text-muted-foreground text-xs">→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
