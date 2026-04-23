"use client";

import { useState, useMemo } from "react";
import { MatchCard } from "@/components/match-card";
import { predWinnerIsHome, type FullPred } from "@/lib/predictor/winner";
import { useLocale } from "@/lib/use-locale";
import { t } from "@/lib/i18n";

type BracketMatch = {
  matchId: string;
  leagueId: string;
  roundType: string;
  roundName: string;
  matchNumber: number;
  homeSlot: string | null;
  awaySlot: string | null;
  homeTeam: string;
  homeFlag: string;
  awayTeam: string;
  awayFlag: string;
  scheduledAt: string;
  savedHome: number | null;
  savedAway: number | null;
  savedHomeET: number | null;
  savedAwayET: number | null;
  savedHomePen: number | null;
  savedAwayPen: number | null;
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
  // Server-computed slot→team map (from group predictions at load time).
  // Keys like "1A", "VM73", "VK97", "VS101" → { name, flag }
  initialSlotMap: Record<string, { name: string; flag: string }>;
};

// Compact labels for the bracket overview column headers (space is tight)
function getRoundCompact(locale: ReturnType<typeof useLocale>): Record<string, string> {
  return {
    ROUND_OF_32: t("roundOf32Label", locale),
    ROUND_OF_16: t("roundOf16Label", locale),
    QF: t("quarterFinalLabel", locale),
    SF: t("semiFinalLabel", locale),
    FINAL: t("finalBronzeLabel", locale),
    THIRD_PLACE: t("bronzeMatchLabel", locale),
  };
}

const SESSION_KEY = "bracket-active-round";

// Slot-key prefixes that map match winners to the next round's venue slots:
//   R32/R16 winners → "VM{matchNumber}"
//   QF winners      → "VK{matchNumber}"
//   SF winners      → "VS{matchNumber}"
function winnerSlotKey(roundType: string, matchNumber: number): string {
  if (roundType === "QF") return `VK${matchNumber}`;
  if (roundType === "SF") return `VS${matchNumber}`;
  return `VM${matchNumber}`;
}

function isTbdSlot(slot: string | null, slotMap: Map<string, { name: string; flag: string }>): boolean {
  return slot !== null && !slotMap.has(slot);
}

function slotLabel(slot: string | null, locale: ReturnType<typeof useLocale>): string {
  if (!slot) return "TBD";
  if (slot.startsWith("VM")) return `${t("slotWinnerMatchPrefix", locale)} ${slot.slice(2)}`;
  if (slot.startsWith("VK")) return `${t("slotWinnerQFPrefix", locale)} ${slot.slice(2)}`;
  if (slot.startsWith("VS")) return `${t("slotWinnerSFPrefix", locale)} ${slot.slice(2)}`;
  if (slot.startsWith("VB")) return `${t("slotLoserSFPrefix", locale)} ${slot.slice(2)}`;
  if (/^[123][A-L]/.test(slot)) {
    const pos = slot[0] === "1" ? t("slotFirst", locale) : slot[0] === "2" ? t("slotSecond", locale) : t("slotThird", locale);
    return `${pos} ${slot.slice(1)}`;
  }
  return slot;
}

export function BracketView({ matches, rounds, leagueId, initialSlotMap }: Props) {
  const locale = useLocale();
  const ROUND_COMPACT = getRoundCompact(locale);
  const [activeRound, setActiveRound] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved && rounds.some((r) => r.roundType === saved)) return saved;
    }
    return rounds[0]?.roundType ?? "";
  });

  function switchRound(roundType: string) {
    setActiveRound(roundType);
    sessionStorage.setItem(SESSION_KEY, roundType);
  }

  const [cascadeCount, setCascadeCount] = useState(0);

  const [predMap, setPredMap] = useState<Map<string, FullPred>>(() => {
    const m = new Map<string, FullPred>();
    for (const match of matches) {
      if (match.savedHome !== null && match.savedAway !== null) {
        m.set(match.matchId, {
          home: match.savedHome,
          away: match.savedAway,
          homeET: match.savedHomeET,
          awayET: match.savedAwayET,
          homePen: match.savedHomePen,
          awayPen: match.savedAwayPen,
        });
      }
    }
    return m;
  });

  function handleSave(matchId: string, pred: FullPred, invalidatedMatchIds: string[]) {
    setPredMap((prev) => {
      const next = new Map(prev).set(matchId, pred);
      for (const id of invalidatedMatchIds) next.delete(id);
      return next;
    });
    if (invalidatedMatchIds.length > 0) {
      setCascadeCount(invalidatedMatchIds.length);
    }
  }

  // Build a live slot→team map by starting from the server-computed group slot map
  // and layering in winners derived from the user's current bracket predictions.
  // Matches are processed in matchNumber order so R32 feeds R16 feeds QF etc.
  // This runs purely client-side so team names update the instant a tip is saved.
  const slotMap = useMemo(() => {
    const map = new Map<string, { name: string; flag: string }>(
      Object.entries(initialSlotMap)
    );
    const sorted = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);
    for (const m of sorted) {
      if (m.matchNumber == null) continue;
      const pred = predMap.get(m.matchId);
      if (!pred) continue;
      const home = m.homeSlot ? (map.get(m.homeSlot) ?? null) : { name: m.homeTeam, flag: m.homeFlag };
      const away = m.awaySlot ? (map.get(m.awaySlot) ?? null) : { name: m.awayTeam, flag: m.awayFlag };
      const winnerIsHome = predWinnerIsHome(pred);
      if (winnerIsHome === null) continue; // draw with no ET/penalty result — slot stays TBD
      const winner = winnerIsHome ? home : away;
      if (winner) {
        map.set(winnerSlotKey(m.roundType, m.matchNumber), winner);
      }
      // For SF matches also track the loser — they play in the bronze match
      if (m.roundType === "SF") {
        const loser = winnerIsHome ? away : home;
        if (loser) map.set(`VB${m.matchNumber}`, loser);
      }
    }
    return map;
  }, [matches, predMap, initialSlotMap]);

  // Apply slot resolution to every match for display
  const resolvedMatches = useMemo(() => {
    return matches.map((m) => {
      const home = m.homeSlot ? (slotMap.get(m.homeSlot) ?? null) : { name: m.homeTeam, flag: m.homeFlag };
      const away = m.awaySlot ? (slotMap.get(m.awaySlot) ?? null) : { name: m.awayTeam, flag: m.awayFlag };
      return {
        ...m,
        // When a slot exists but is not yet resolved (TBD), show the slot label
        // instead of the stale server-computed name from page load.
        homeTeam: home?.name ?? (m.homeSlot ? slotLabel(m.homeSlot, locale) : m.homeTeam),
        homeFlag: home?.flag ?? (m.homeSlot ? "🏳" : m.homeFlag),
        awayTeam: away?.name ?? (m.awaySlot ? slotLabel(m.awaySlot, locale) : m.awayTeam),
        awayFlag: away?.flag ?? (m.awaySlot ? "🏳" : m.awayFlag),
        isTbd: isTbdSlot(m.homeSlot, slotMap) || isTbdSlot(m.awaySlot, slotMap),
      };
    });
  }, [matches, slotMap]);

  // THIRD_PLACE (bronsmatch) is shown inside the FINAL tab — no separate tab.
  const activeMatches = resolvedMatches.filter(
    (m) => m.roundType === activeRound || (activeRound === "FINAL" && m.roundType === "THIRD_PLACE")
  );
  const activeRoundMeta = rounds.find((r) => r.roundType === activeRound);

  const activeRoundIndex = rounds.findIndex((r) => r.roundType === activeRound);
  const prevRound = activeRoundIndex > 0 ? rounds[activeRoundIndex - 1] : null;
  const nextRound = activeRoundIndex < rounds.length - 1 ? rounds[activeRoundIndex + 1] : null;

  // Count tips per round for badge.
  // Use predMap only (initialized from server existingHome, updated on saves/clears).
  // Do NOT fall back to m.existingHome — that would keep counting cleared predictions.
  // FINAL count includes THIRD_PLACE matches.
  const tipsByRound = new Map<string, number>();
  for (const r of rounds) {
    const roundMatches = matches.filter(
      (m) => m.roundType === r.roundType || (r.roundType === "FINAL" && m.roundType === "THIRD_PLACE")
    );
    const tipped = roundMatches.filter((m) => predMap.has(m.matchId)).length;
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
                onClick={() => switchRound(r.roundType)}
                className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  activeRound === r.roundType
                    ? allTipped
                      ? "bg-green-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : allTipped
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {ROUND_COMPACT[r.roundType] ?? r.roundName}
                {allTipped && (
                  <span className="text-[10px] leading-none">✓</span>
                )}
                {!allTipped && tipped > 0 && (
                  <span className="text-[10px] leading-none opacity-70">{tipped}/{total}</span>
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
              ? t("tbdR32", locale)
              : activeRound === "ROUND_OF_16"
              ? t("tbdR16", locale)
              : activeRound === "QF"
              ? t("tbdQF", locale)
              : activeRound === "SF"
              ? t("tbdSF", locale)
              : t("tbdFinal", locale)}
          </p>
        </div>
      )}

      {/* Cascade notice — shown when an upstream winner change cleared downstream predictions */}
      {cascadeCount > 0 && (
        <div className="mb-1 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 flex items-start justify-between gap-2">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            {t("winnerChanged", locale)} — {cascadeCount} {t("subsequentCleared", locale)} {cascadeCount === 1 ? t("match", locale) : t("matches", locale)} {t("clearedAutomatically", locale)}
          </p>
          <button onClick={() => setCascadeCount(0)} className="text-blue-500 text-xs shrink-0 leading-none mt-0.5">✕</button>
        </div>
      )}

      {/* Match cards */}
      <div className="flex flex-col gap-3">
        {activeMatches.map((m) => {
          const pred = predMap.get(m.matchId);
          return (
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
              savedHome={pred?.home ?? null}
              savedAway={pred?.away ?? null}
              savedHomeET={pred?.homeET ?? null}
              savedAwayET={pred?.awayET ?? null}
              savedHomePen={pred?.homePen ?? null}
              savedAwayPen={pred?.awayPen ?? null}
              isLocked={m.isLocked}
              actualHome={m.actualHome}
              actualAway={m.actualAway}
              pointsEarned={m.pointsEarned}
              isKnockout={true}
              onSave={handleSave}
            />
          );
        })}
        {activeMatches.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            {t("noMatchesInRound", locale)}
          </p>
        )}
      </div>

      {/* Round navigation */}
      <div className="flex items-center justify-between gap-3 pt-2 pb-4">
        {prevRound ? (
          <button
            onClick={() => { switchRound(prevRound.roundType); requestAnimationFrame(() => window.scrollTo(0, 0)); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60 transition-colors"
          >
            ← {prevRound.roundName}
          </button>
        ) : (
          <div />
        )}
        {nextRound ? (
          <button
            onClick={() => { switchRound(nextRound.roundType); requestAnimationFrame(() => window.scrollTo(0, 0)); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary/60 transition-colors"
          >
            {nextRound.roundName} →
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Bracket overview (mini) */}
      <BracketOverview
        matches={resolvedMatches}
        rounds={rounds}
        activeRound={activeRound}
        onSelectRound={switchRound}
        predMap={predMap}
      />
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
  predMap: Map<string, FullPred>;
}) {
  const locale = useLocale();
  const ROUND_COMPACT = getRoundCompact(locale);
  if (rounds.length < 2) return null;

  return (
    <div className="mt-6 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/50 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {locale === "en" ? "Bracket overview" : "Bracket-översikt"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-0 min-w-max p-3">
          {rounds.map((r, ri) => {
            const allRoundMatches = matches.filter(
              (m) => m.roundType === r.roundType || (r.roundType === "FINAL" && m.roundType === "THIRD_PLACE")
            );
            const mainMatches = allRoundMatches.filter((m) => m.roundType !== "THIRD_PLACE");
            const bronzeMatches = allRoundMatches.filter((m) => m.roundType === "THIRD_PLACE");
            const isActive = r.roundType === activeRound;

            function MatchMini({ m }: { m: BracketMatch }) {
              const pred = predMap.get(m.matchId);
              return (
                <button
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
                  {pred && (
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono tabular-nums">
                      {pred.home}–{pred.away}
                    </div>
                  )}
                </button>
              );
            }

            return (
              <div key={r.roundType} className="flex items-center">
                <div className="flex flex-col gap-2 min-w-[110px] px-1">
                  <p className="text-[10px] font-semibold text-center text-muted-foreground uppercase tracking-wide mb-1">
                    {ROUND_COMPACT[r.roundType] ?? r.roundName}
                  </p>
                  {mainMatches.map((m) => <MatchMini key={m.matchId} m={m} />)}
                  {bronzeMatches.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 pt-1">
                        <div className="flex-1 h-px bg-border/60" />
                        <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide whitespace-nowrap">
                          {locale === "en" ? "3rd place" : "3:e plats"}
                        </span>
                        <div className="flex-1 h-px bg-border/60" />
                      </div>
                      {bronzeMatches.map((m) => (
                        <div key={m.matchId} className="opacity-60">
                          <MatchMini m={m} />
                        </div>
                      ))}
                    </>
                  )}
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
