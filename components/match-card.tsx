"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FullPred } from "@/lib/predictor/winner";
import { useLocale } from "@/lib/use-locale";
import { t } from "@/lib/i18n";

// Prevent more than 2 digits in score inputs (max 99)
function clamp2(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  if (el.value.length > 2) el.value = el.value.slice(0, 2);
}

type Props = {
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
  // ET and penalty fields (knockout matches only)
  savedHomeET?: number | null;
  savedAwayET?: number | null;
  savedHomePen?: number | null;
  savedAwayPen?: number | null;
  isKnockout?: boolean;
  isLocked: boolean;
  actualHome: number | null;
  actualAway: number | null;
  pointsEarned: number | null;
  onSave?: (matchId: string, pred: FullPred, invalidatedMatchIds: string[]) => void;
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
  savedHome,
  savedAway,
  savedHomeET = null,
  savedAwayET = null,
  savedHomePen = null,
  savedAwayPen = null,
  isKnockout = false,
  isLocked,
  actualHome,
  actualAway,
  pointsEarned,
  onSave,
}: Props) {
  // Draft inputs — what the user is currently typing
  const [home, setHome] = useState(savedHome?.toString() ?? "");
  const [away, setAway] = useState(savedAway?.toString() ?? "");
  const [homeET, setHomeET] = useState(savedHomeET?.toString() ?? "");
  const [awayET, setAwayET] = useState(savedAwayET?.toString() ?? "");
  const [homePen, setHomePen] = useState(savedHomePen?.toString() ?? "");
  const [awayPen, setAwayPen] = useState(savedAwayPen?.toString() ?? "");

  // Last committed values — updated optimistically on save, reset by parent on cascade clear.
  const [committedHome, setCommittedHome] = useState<number | null>(savedHome);
  const [committedAway, setCommittedAway] = useState<number | null>(savedAway);
  const [committedHomeET, setCommittedHomeET] = useState<number | null>(savedHomeET ?? null);
  const [committedAwayET, setCommittedAwayET] = useState<number | null>(savedAwayET ?? null);
  const [committedHomePen, setCommittedHomePen] = useState<number | null>(savedHomePen ?? null);
  const [committedAwayPen, setCommittedAwayPen] = useState<number | null>(savedAwayPen ?? null);

  const router = useRouter();
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    savedHome !== null ? "saved" : "idle"
  );
  const [showOthers, setShowOthers] = useState(false);
  const [others, setOthers] = useState<MemberPrediction[] | null>(null);
  const [loadingOthers, setLoadingOthers] = useState(false);

  // When the parent changes saved* props (e.g. cascade clears a downstream match),
  // sync the local committed state and reset the draft inputs.
  useEffect(() => {
    setCommittedHome(savedHome);
    setCommittedAway(savedAway);
    setCommittedHomeET(savedHomeET ?? null);
    setCommittedAwayET(savedAwayET ?? null);
    setCommittedHomePen(savedHomePen ?? null);
    setCommittedAwayPen(savedAwayPen ?? null);
    setHome(savedHome?.toString() ?? "");
    setAway(savedAway?.toString() ?? "");
    setHomeET(savedHomeET?.toString() ?? "");
    setAwayET(savedAwayET?.toString() ?? "");
    setHomePen(savedHomePen?.toString() ?? "");
    setAwayPen(savedAwayPen?.toString() ?? "");
    setStatus(savedHome !== null ? "saved" : "idle");
  }, [savedHome, savedAway, savedHomeET, savedAwayET, savedHomePen, savedAwayPen]);

  // ── Derived display logic ──────────────────────────────────────────────────
  const hNum = parseInt(home, 10);
  const aNum = parseInt(away, 10);
  const regularTimeDraw = !isNaN(hNum) && !isNaN(aNum) && hNum === aNum;

  const hETNum = parseInt(homeET, 10);
  const aETNum = parseInt(awayET, 10);
  const etFilled = homeET !== "" && awayET !== "";
  const etDraw = etFilled && !isNaN(hETNum) && !isNaN(aETNum) && hETNum === aETNum;

  const showET = isKnockout && regularTimeDraw && home !== "" && away !== "";
  const showPen = showET && etFilled && etDraw;

  const hPenNum = parseInt(homePen, 10);
  const aPenNum = parseInt(awayPen, 10);
  const penDraw = homePen !== "" && awayPen !== "" && !isNaN(hPenNum) && !isNaN(aPenNum) && hPenNum === aPenNum;

  const hasPrediction = committedHome !== null;

  const dirty =
    home !== (committedHome?.toString() ?? "") ||
    away !== (committedAway?.toString() ?? "") ||
    homeET !== (committedHomeET?.toString() ?? "") ||
    awayET !== (committedAwayET?.toString() ?? "") ||
    homePen !== (committedHomePen?.toString() ?? "") ||
    awayPen !== (committedAwayPen?.toString() ?? "");

  // Save button is disabled when penalties are showing and the scores are equal
  const penaltyDrawError = showPen && homePen !== "" && awayPen !== "" && penDraw;

  // When ET section is visible, both ET fields must be filled before saving.
  // When penalty section is visible, both penalty fields must be filled too.
  const etRequired = showET && (homeET === "" || awayET === "");
  const penRequired = showPen && (homePen === "" || awayPen === "");

  const saveDisabled =
    status === "saving" ||
    home === "" ||
    away === "" ||
    etRequired ||
    penRequired ||
    penaltyDrawError;

  async function save() {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;

    const hetVal = showET && homeET !== "" ? parseInt(homeET, 10) : null;
    const aetVal = showET && awayET !== "" ? parseInt(awayET, 10) : null;
    const hpenVal = showPen && homePen !== "" ? parseInt(homePen, 10) : null;
    const apenVal = showPen && awayPen !== "" ? parseInt(awayPen, 10) : null;

    // Guard: ET values must both be valid if either is present
    if ((hetVal === null) !== (aetVal === null)) return;
    if ((hpenVal === null) !== (apenVal === null)) return;
    // Guard: penalty draw is forbidden
    if (hpenVal !== null && apenVal !== null && hpenVal === apenVal) return;

    setStatus("saving");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
        const res = await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            leagueId,
            homeScorePred: h,
            awayScorePred: a,
            homeExtraTimePred: hetVal,
            awayExtraTimePred: aetVal,
            homePenaltyPred: hpenVal,
            awayPenaltyPred: apenVal,
          }),
        });
        if (res.ok) {
          // Parse the body before touching state. A body-read failure must NOT
          // trigger the retry loop — the save already succeeded in the DB.
          let invalidatedMatchIds: string[] = [];
          try {
            const data = await res.json();
            invalidatedMatchIds = data.invalidatedMatchIds ?? [];
          } catch {
            // Body parse failed — save is confirmed but cascade data is lost.
            // Refresh the page so the server re-fetches the canonical state and
            // any downstream predictions that were deleted by cascade go blank.
            onSave?.(matchId, { home: h, away: a, homeET: hetVal, awayET: aetVal, homePen: hpenVal, awayPen: apenVal }, []);
            setCommittedHome(h);
            setCommittedAway(a);
            setCommittedHomeET(hetVal);
            setCommittedAwayET(aetVal);
            setCommittedHomePen(hpenVal);
            setCommittedAwayPen(apenVal);
            setStatus("saved");
            router.refresh();
            return;
          }
          setCommittedHome(h);
          setCommittedAway(a);
          setCommittedHomeET(hetVal);
          setCommittedAwayET(aetVal);
          setCommittedHomePen(hpenVal);
          setCommittedAwayPen(apenVal);
          setStatus("saved");
          onSave?.(matchId, {
            home: h, away: a,
            homeET: hetVal, awayET: aetVal,
            homePen: hpenVal, awayPen: apenVal,
          }, invalidatedMatchIds);
          return;
        }
        if (res.status < 500) break; // Don't retry 4xx client errors
      } catch {
        // Network error — retry
      }
    }
    setStatus("error");
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
    timeZone: "Europe/Stockholm",
  });

  const savedAndClean = status === "saved" && !dirty;
  const hasResult = actualHome !== null && actualAway !== null;
  const myBadge = pointsBadgeStyle(pointsEarned);

  // Shared score-row renderer used for regular time, ET, and penalty rows
  function ScoreRow({
    label,
    homeVal,
    awayVal,
    onHomeChange,
    onAwayChange,
    noDraw,
    showDrawError,
  }: {
    label: string;
    homeVal: string;
    awayVal: string;
    onHomeChange: (v: string) => void;
    onAwayChange: (v: string) => void;
    noDraw?: boolean;
    showDrawError?: boolean;
  }) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center">
          {label}
        </p>
        <div className="flex items-center px-4 gap-2">
          <div className="flex-1" />
          <div className="shrink-0 flex items-center gap-1.5 mx-1">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={homeVal}
              onInput={clamp2}
              onChange={(e) => { onHomeChange(e.target.value); setStatus("idle"); }}
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
              value={awayVal}
              onInput={clamp2}
              onChange={(e) => { onAwayChange(e.target.value); setStatus("idle"); }}
              onFocus={(e) => e.target.select()}
              className="w-12 h-12 text-center rounded-lg border border-border bg-background text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
              placeholder="–"
            />
          </div>
          <div className="flex-1" />
        </div>
        {noDraw && showDrawError && (
          <p className="text-[11px] text-destructive text-center">{t("drawNotAllowedInPenalties", locale)}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-card transition-colors ${
      savedAndClean && !isLocked ? "border-green-200 bg-green-50/30" :
      hasResult && pointsEarned === 3 ? "border-green-200 bg-green-50/20" :
      hasResult && pointsEarned === 1 ? "border-blue-200 bg-blue-50/20" :
      "border-border"
    }`}>
      {/* Meta row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-semibold text-foreground tracking-wide">
          {groupName}
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

      {/* Teams + regular time score row */}
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
                  <span className="text-xs text-muted-foreground">{t("matchLive", locale)}</span>
                </div>
              )}
              {hasPrediction && (
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {t("yourPick", locale)} {committedHome}–{committedAway}
                  {committedHomeET !== null && committedAwayET !== null && (
                    <> (FT: {committedHomeET}–{committedAwayET}{committedHomePen !== null && committedAwayPen !== null && `, str: ${committedHomePen}–${committedAwayPen}`})</>
                  )}
                </span>
              )}
              {!hasPrediction && (
                <span className="text-xs text-muted-foreground">{t("noPick", locale)}</span>
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
                onInput={clamp2}
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
                onInput={clamp2}
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

      {/* Extra time section — appears when regular time is a draw in a knockout match */}
      {!isLocked && showET && (
        <div className="px-4 pb-3 border-t border-border/60 pt-3 flex flex-col gap-3">
          <ScoreRow
            label={t("extraTime", locale)}
            homeVal={homeET}
            awayVal={awayET}
            onHomeChange={setHomeET}
            onAwayChange={setAwayET}
          />
          {/* Penalty section — appears when ET is also a draw */}
          {showPen && (
            <ScoreRow
              label={t("penalties", locale)}
              homeVal={homePen}
              awayVal={awayPen}
              onHomeChange={setHomePen}
              onAwayChange={setAwayPen}
              noDraw
              showDrawError={penaltyDrawError}
            />
          )}
        </div>
      )}

      {/* Save button row */}
      {!isLocked && (
        <div className="px-4 pb-3">
          <button
            onClick={save}
            disabled={saveDisabled}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              savedAndClean
                ? "bg-green-100 text-green-700 border border-green-200"
                : status === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : saveDisabled
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {status === "saving"
              ? t("saving", locale)
              : savedAndClean
              ? t("saved", locale)
              : status === "error"
              ? t("saveError", locale)
              : t("save", locale)}
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
            <span>{t("showAllPicks", locale)}</span>
            <span className="text-base leading-none">{showOthers ? "−" : "+"}</span>
          </button>

          {showOthers && (
            <div className="px-4 pb-3 flex flex-col gap-1.5">
              {loadingOthers && (
                <p className="text-xs text-muted-foreground py-2 text-center">{t("loading", locale)}</p>
              )}
              {!loadingOthers && others && others.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  {t("noPicksPlaced", locale)}
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
                      {p.displayName}{p.isCurrentUser && ` ${t("youSuffix", locale)}`}
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
