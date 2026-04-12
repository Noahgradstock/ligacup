"use client";

import { useState, useTransition, useEffect } from "react";
import type { Top3Entry } from "@/app/api/leagues/[id]/top3/route";

function toFlag(code: string | null) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export type LockedMatch = {
  matchId: string;
  groupName: string | null;
  scheduledAt: string; // ISO string
  homeTeamName: string;
  homeTeamCode: string | null;
  awayTeamName: string;
  awayTeamCode: string | null;
  isResultConfirmed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  predictions: { userId: string; home: number; away: number }[];
};

export type KnockoutMatchRow = {
  matchId: string;
  roundType: string;
  roundName: string;
  matchNumber: number;
  scheduledAt: string;
  homeTeamName: string;
  homeTeamCode: string | null;
  awayTeamName: string;
  awayTeamCode: string | null;
  isResultConfirmed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  predictions: {
    userId: string;
    home: number;
    away: number;
    homeET: number | null;
    awayET: number | null;
    homePen: number | null;
    awayPen: number | null;
    resolvedHome: { name: string; flag: string } | null;
    resolvedAway: { name: string; flag: string } | null;
  }[];
};

export type MemberInfo = {
  userId: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
};

export type TeamOption = {
  id: string;
  name: string;
  countryCode: string | null;
};

type Props = {
  leagueId: string;
  currentUserId: string | null;
  hasMatchScores: boolean;
  members: MemberInfo[];
  lockedMatches: LockedMatch[];
  top3: Top3Entry[];
  allTeams: TeamOption[];
  groups: string[]; // e.g. ["A", "B", ...]
  hideTop3?: boolean; // when true, omit the VM Top 3 chip (already shown elsewhere)
  knockoutMatches?: KnockoutMatchRow[];
  knockoutRounds?: { roundType: string; roundName: string }[];
};

type Filter = "nearest" | "top3" | string; // string = group name

function memberLabel(m: MemberInfo) {
  return m.displayName ?? m.email.split("@")[0];
}

function MemberAvatar({ m, size = 6 }: { m: MemberInfo; size?: number }) {
  const label = memberLabel(m);
  const cls = `w-${size} h-${size} rounded-full shrink-0 object-cover`;
  if (m.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.avatarUrl} alt={label} className={cls} />;
  }
  return (
    <div
      className={`w-${size} h-${size} rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground uppercase shrink-0`}
    >
      {label.slice(0, 1)}
    </div>
  );
}

function predClass(
  home: number,
  away: number,
  actualHome: number | null,
  actualAway: number | null,
  confirmed: boolean
) {
  if (!confirmed || actualHome === null || actualAway === null) return "";
  if (home === actualHome && away === actualAway)
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  const predWinner = home > away ? "home" : away > home ? "away" : "draw";
  const actualWinner =
    actualHome > actualAway ? "home" : actualAway > actualHome ? "away" : "draw";
  if (predWinner === actualWinner)
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  return "bg-muted text-muted-foreground line-through";
}

function MatchCard({
  homeTeamName,
  homeTeamCode,
  awayTeamName,
  awayTeamCode,
  scheduledAt,
  label,
  isResultConfirmed,
  homeScore,
  awayScore,
  preds,
  currentUserId,
  memberMap,
}: {
  homeTeamName: string;
  homeTeamCode: string | null;
  awayTeamName: string;
  awayTeamCode: string | null;
  scheduledAt: string;
  label: string;
  isResultConfirmed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  preds: { userId: string; home: number; away: number }[];
  currentUserId: string | null;
  memberMap: Map<string, MemberInfo>;
}) {
  const date = new Date(scheduledAt);
  const isUpcoming = date.getTime() > Date.now();
  const dateStr = date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Match header */}
      <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
        <span className="text-xs font-medium">
          {toFlag(homeTeamCode)} {homeTeamName}{" "}
          <span className="text-muted-foreground mx-1">vs</span>{" "}
          {toFlag(awayTeamCode)} {awayTeamName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isResultConfirmed && homeScore !== null ? (
            <span className="text-xs font-bold text-primary">
              {homeScore}–{awayScore}
            </span>
          ) : isUpcoming ? (
            <span className="text-xs text-muted-foreground">{timeStr}</span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {label ? `${label} · ` : ""}{dateStr}
          </span>
        </div>
      </div>

      {/* Predictions */}
      <div className="divide-y divide-border">
        {preds.length === 0 ? (
          <p className="px-3 py-2.5 text-xs text-muted-foreground">Inga tips</p>
        ) : (
          preds.map((pred) => {
            const member = memberMap.get(pred.userId);
            if (!member) return null;
            const cls = predClass(pred.home, pred.away, homeScore, awayScore, isResultConfirmed);
            const isMe = member.userId === currentUserId;
            return (
              <div
                key={pred.userId}
                className={`flex items-center justify-between px-3 py-2 ${isMe ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <MemberAvatar m={member} size={5} />
                  <span className={`text-xs font-medium ${isMe ? "text-primary" : ""}`}>
                    {memberLabel(member)}
                  </span>
                </div>
                <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded ${cls || "bg-secondary/60"}`}>
                  {pred.home}–{pred.away}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function KnockoutMatchCard({
  homeTeamName,
  homeTeamCode,
  awayTeamName,
  awayTeamCode,
  scheduledAt,
  label,
  isResultConfirmed,
  homeScore,
  awayScore,
  preds,
  currentUserId,
  memberMap,
}: {
  homeTeamName: string;
  homeTeamCode: string | null;
  awayTeamName: string;
  awayTeamCode: string | null;
  scheduledAt: string;
  label: string;
  isResultConfirmed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  preds: KnockoutMatchRow["predictions"];
  currentUserId: string | null;
  memberMap: Map<string, MemberInfo>;
}) {
  const date = new Date(scheduledAt);
  const isUpcoming = date.getTime() > Date.now();
  const dateStr = date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center justify-between">
        <span className="text-xs font-medium">
          {toFlag(homeTeamCode)} {homeTeamName}{" "}
          <span className="text-muted-foreground mx-1">vs</span>{" "}
          {toFlag(awayTeamCode)} {awayTeamName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isResultConfirmed && homeScore !== null ? (
            <span className="text-xs font-bold text-primary">
              {homeScore}–{awayScore}
            </span>
          ) : isUpcoming ? (
            <span className="text-xs text-muted-foreground">{timeStr}</span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {label ? `${label} · ` : ""}{dateStr}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {preds.length === 0 ? (
          <p className="px-3 py-2.5 text-xs text-muted-foreground">Inga tips</p>
        ) : (
          preds.map((pred) => {
            const member = memberMap.get(pred.userId);
            if (!member) return null;
            const cls = predClass(pred.home, pred.away, homeScore, awayScore, isResultConfirmed);
            const isMe = member.userId === currentUserId;
            const hasET = pred.homeET !== null && pred.awayET !== null;
            const hasPen = pred.homePen !== null && pred.awayPen !== null;
            return (
              <div
                key={pred.userId}
                className={`flex items-center justify-between px-3 py-2 gap-2 ${isMe ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MemberAvatar m={member} size={5} />
                  <span className={`text-xs font-medium truncate ${isMe ? "text-primary" : ""}`}>
                    {memberLabel(member)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {pred.resolvedHome && (
                    <span className="text-sm leading-none" title={pred.resolvedHome.name}>
                      {pred.resolvedHome.flag}
                    </span>
                  )}
                  <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded ${cls || "bg-secondary/60"}`}>
                    {pred.home}–{pred.away}
                    {hasET && ` (f.t. ${pred.homeET}–${pred.awayET}${hasPen ? `, p. ${pred.homePen}–${pred.awayPen}` : ""})`}
                  </span>
                  {pred.resolvedAway && (
                    <span className="text-sm leading-none" title={pred.resolvedAway.name}>
                      {pred.resolvedAway.flag}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function MemberPredictionsSection({
  leagueId,
  currentUserId,
  hasMatchScores,
  members,
  lockedMatches,
  top3: initialTop3,
  allTeams,
  groups,
  hideTop3 = false,
  knockoutMatches = [],
  knockoutRounds = [],
}: Props) {
  const storageKey = `allas-tips-filter-${leagueId}`;
  const [filter, setFilter] = useState<Filter>(() => {
    if (!hasMatchScores || hideTop3) {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(storageKey) as Filter | null;
        if (saved && saved !== "top3") return saved;
      }
      return "nearest";
    }
    if (!hasMatchScores) return "top3";
    if (typeof window === "undefined") return "nearest";
    return (localStorage.getItem(storageKey) as Filter) ?? "nearest";
  });

  useEffect(() => {
    localStorage.setItem(storageKey, filter);
  }, [filter, storageKey]);
  const [top3, setTop3] = useState<Top3Entry[]>(initialTop3);
  const [editingTop3, setEditingTop3] = useState(false);
  const [first, setFirst] = useState<string>(() => {
    const mine = initialTop3.find((t) => t.userId === currentUserId);
    return mine?.firstTeamId ?? "";
  });
  const [second, setSecond] = useState<string>(() => {
    const mine = initialTop3.find((t) => t.userId === currentUserId);
    return mine?.secondTeamId ?? "";
  });
  const [third, setThird] = useState<string>(() => {
    const mine = initialTop3.find((t) => t.userId === currentUserId);
    return mine?.thirdTeamId ?? "";
  });
  const [isPending, startTransition] = useTransition();

  const memberMap = new Map(members.map((m) => [m.userId, m]));

  // Whether the active filter is a knockout round
  const knockoutRoundTypes = new Set(knockoutRounds.map((r) => r.roundType));
  const isKnockoutFilter = knockoutRoundTypes.has(filter);

  // Derive filtered group matches
  const filteredMatches = (() => {
    if (filter === "top3" || isKnockoutFilter) return [];
    if (filter === "nearest") {
      // 5 matches closest to now — upcoming first, then most recent past
      const now = Date.now();
      const upcoming = [...lockedMatches]
        .filter((m) => new Date(m.scheduledAt).getTime() >= now)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .slice(0, 5);
      if (upcoming.length > 0) return upcoming;
      // Fallback: no upcoming matches — show 5 most recently played
      return [...lockedMatches]
        .filter((m) => new Date(m.scheduledAt).getTime() < now)
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
        .slice(0, 5);
    }
    // Group filter
    return lockedMatches.filter((m) => m.groupName === filter);
  })();

  // Derive filtered knockout matches.
  // THIRD_PLACE (bronsmatch) has no separate tab — it shows inside the FINAL tab.
  const filteredKnockoutMatches = isKnockoutFilter
    ? knockoutMatches.filter(
        (m) => m.roundType === filter || (filter === "FINAL" && m.roundType === "THIRD_PLACE")
      )
    : [];

  async function saveTop3() {
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/top3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstTeamId: first || null,
          secondTeamId: second || null,
          thirdTeamId: third || null,
        }),
      });
      if (res.ok) {
        // Refresh top3 list
        const updated = await fetch(`/api/leagues/${leagueId}/top3`);
        if (updated.ok) setTop3(await updated.json());
        setEditingTop3(false);
      }
    });
  }

  const myTop3 = top3.find((t) => t.userId === currentUserId);
  const hasMyTop3 = myTop3?.firstTeamId != null;

  const topChips: { key: Filter; label: string }[] = hasMatchScores
    ? [
        ...(!hideTop3 ? [{ key: "top3" as Filter, label: "VM Top 3" }] : []),
        { key: "nearest", label: "Närmast" },
      ]
    : (!hideTop3 ? [{ key: "top3" as Filter, label: "VM Top 3" }] : []);

  function Chip({ chipKey, label }: { chipKey: Filter; label: string }) {
    return (
      <button
        onClick={() => setFilter(chipKey)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors shrink-0 ${
          filter === chipKey
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-muted-foreground border-border hover:bg-secondary/50"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Allas tips</h2>
      </div>

      {/* Filter chips */}
      <div className="flex flex-col gap-2">
        {/* Top-level chips */}
        <div className="flex gap-2">
          {topChips.map((c) => (
            <Chip key={c.key} chipKey={c.key} label={c.label} />
          ))}
        </div>

        {/* Group chips with label */}
        {hasMatchScores && groups.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
              Grupper
            </span>
            {groups.map((g) => (
              <Chip key={g} chipKey={g} label={g} />
            ))}
          </div>
        )}

        {/* Knockout round chips with label */}
        {knockoutRounds.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
              Slutspel
            </span>
            {knockoutRounds.map((r) => (
              <Chip key={r.roundType} chipKey={r.roundType} label={r.roundName} />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {filter === "top3" ? (
        <div className="flex flex-col gap-2">
          {/* Current user CTA if no pick yet */}
          {currentUserId && !hasMyTop3 && !editingTop3 && (
            <button
              onClick={() => setEditingTop3(true)}
              className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-primary font-medium text-left hover:bg-primary/10 transition-colors"
            >
              + Sätt ditt VM-tips (1:a, 2:a, 3:a)
            </button>
          )}

          {/* Inline edit form */}
          {currentUserId && editingTop3 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col gap-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Ditt VM-tips</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "🥇 1:a", val: first, set: setFirst },
                  { label: "🥈 2:a", val: second, set: setSecond },
                  { label: "🥉 3:a", val: third, set: setThird },
                ].map((slot) => (
                  <div key={slot.label} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{slot.label}</span>
                    <select
                      value={slot.val}
                      onChange={(e) => slot.set(e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Välj lag</option>
                      {allTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {toFlag(t.countryCode)} {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveTop3}
                  disabled={isPending}
                  className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                >
                  {isPending ? "Sparar..." : "Spara"}
                </button>
                <button
                  onClick={() => setEditingTop3(false)}
                  className="px-4 py-1.5 rounded border border-border text-xs font-medium text-muted-foreground"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {/* Top3 table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {members.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-muted-foreground">
                Inga tips ännu.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Deltagare</th>
                    <th className="px-2 py-2 text-center font-medium">🥇</th>
                    <th className="px-2 py-2 text-center font-medium">🥈</th>
                    <th className="px-2 py-2 text-center font-medium">🥉</th>
                    {currentUserId && <th className="px-2 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const pick = top3.find((t) => t.userId === m.userId);
                    const isMe = m.userId === currentUserId;
                    return (
                      <tr
                        key={m.userId}
                        className={`border-b border-border last:border-0 ${isMe ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <MemberAvatar m={m} size={6} />
                            <span className={`font-medium truncate max-w-[80px] ${isMe ? "text-primary" : ""}`}>
                              {memberLabel(m)}
                            </span>
                          </div>
                        </td>
                        {[
                          { name: pick?.firstTeamName, code: pick?.firstTeamCode },
                          { name: pick?.secondTeamName, code: pick?.secondTeamCode },
                          { name: pick?.thirdTeamName, code: pick?.thirdTeamCode },
                        ].map((slot, i) => (
                          <td key={i} className="px-2 py-2.5 text-center">
                            {slot.name ? (
                              <span className="text-sm" title={slot.name}>
                                {toFlag(slot.code ?? null)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">–</span>
                            )}
                          </td>
                        ))}
                        {currentUserId && (
                          <td className="px-2 py-2.5 text-right">
                            {isMe && (
                              <button
                                onClick={() => setEditingTop3(true)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Ändra
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {isKnockoutFilter ? (
            // Knockout round view
            filteredKnockoutMatches.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                Inga matcher i denna runda.
              </div>
            ) : (
              filteredKnockoutMatches.map((match) => (
                <KnockoutMatchCard
                  key={match.matchId}
                  homeTeamName={match.homeTeamName}
                  homeTeamCode={match.homeTeamCode}
                  awayTeamName={match.awayTeamName}
                  awayTeamCode={match.awayTeamCode}
                  scheduledAt={match.scheduledAt}
                  label={match.roundName}
                  isResultConfirmed={match.isResultConfirmed}
                  homeScore={match.homeScore}
                  awayScore={match.awayScore}
                  preds={match.predictions}
                  currentUserId={currentUserId}
                  memberMap={memberMap}
                />
              ))
            )
          ) : filteredMatches.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              {filter === "nearest"
                ? "Inga matcher hittades."
                : "Inga matcher i denna grupp."}
            </div>
          ) : (
            filteredMatches.map((match) => (
              <MatchCard
                key={match.matchId}
                homeTeamName={match.homeTeamName}
                homeTeamCode={match.homeTeamCode}
                awayTeamName={match.awayTeamName}
                awayTeamCode={match.awayTeamCode}
                scheduledAt={match.scheduledAt}
                label={match.groupName ? `Grupp ${match.groupName}` : ""}
                isResultConfirmed={match.isResultConfirmed}
                homeScore={match.homeScore}
                awayScore={match.awayScore}
                preds={match.predictions}
                currentUserId={currentUserId}
                memberMap={memberMap}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
