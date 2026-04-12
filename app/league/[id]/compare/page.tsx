export const dynamic = "force-dynamic";

import { eq, and, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  users,
  tournamentTop3Predictions,
  bonusPredictions,
  teams,
  matches,
  tournamentRounds,
  predictions,
} from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { CompareView } from "@/components/compare-view";
import { MemberPredictionsSection } from "@/components/member-predictions-section";
import type { Top3Entry } from "@/app/api/leagues/[id]/top3/route";
import { computeGroupStandings, rankThirdPlacedTeams, assignThirdsToSlots } from "@/lib/predictor/standings";
import { predWinnerIsHome } from "@/lib/predictor/winner";

function toFlag(code: string | null | undefined) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [dbUser, league] = await Promise.all([
    syncCurrentUser(),
    db.select().from(leagues).where(eq(leagues.id, id)).limit(1).then((r) => r[0] ?? null),
  ]);

  if (!league) notFound();

  if (dbUser) {
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, id),
          eq(leagueMembers.userId, dbUser.id),
          eq(leagueMembers.isActive, true)
        )
      )
      .limit(1);
    if (!membership) notFound();
  }

  const config = league.configJson as {
    features?: string[];
  } | null;
  const features = config?.features ?? [];
  const hasTopScorer = features.includes("top_scorer");
  const hasYellowCards = features.includes("most_yellow_cards");
  const hasMatchScores = features.includes("match_scores");

  // All active league members
  const members = await db
    .select({
      userId: leagueMembers.userId,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(leagueMembers)
    .innerJoin(users, eq(leagueMembers.userId, users.id))
    .where(and(eq(leagueMembers.leagueId, id), eq(leagueMembers.isActive, true)));

  // Top 3 predictions — join all three team aliases
  const t1 = alias(teams, "t1");
  const t2 = alias(teams, "t2");
  const t3 = alias(teams, "t3");

  const top3Rows = await db
    .select({
      userId: tournamentTop3Predictions.userId,
      firstTeamId: tournamentTop3Predictions.firstTeamId,
      firstTeamName: t1.name,
      firstTeamCode: t1.countryCode,
      secondTeamId: tournamentTop3Predictions.secondTeamId,
      secondTeamName: t2.name,
      secondTeamCode: t2.countryCode,
      thirdTeamId: tournamentTop3Predictions.thirdTeamId,
      thirdTeamName: t3.name,
      thirdTeamCode: t3.countryCode,
    })
    .from(tournamentTop3Predictions)
    .leftJoin(t1, eq(tournamentTop3Predictions.firstTeamId, t1.id))
    .leftJoin(t2, eq(tournamentTop3Predictions.secondTeamId, t2.id))
    .leftJoin(t3, eq(tournamentTop3Predictions.thirdTeamId, t3.id))
    .where(eq(tournamentTop3Predictions.leagueId, id));

  const top3 = top3Rows.map((r) => ({
    userId: r.userId,
    first: r.firstTeamName ? { name: r.firstTeamName, flag: toFlag(r.firstTeamCode) } : null,
    second: r.secondTeamName ? { name: r.secondTeamName, flag: toFlag(r.secondTeamCode) } : null,
    third: r.thirdTeamName ? { name: r.thirdTeamName, flag: toFlag(r.thirdTeamCode) } : null,
  }));

  // Top3 in Top3Entry shape (with IDs) for MemberPredictionsSection edit form
  const top3ForSection: Top3Entry[] = top3Rows.map((r) => ({
    userId: r.userId,
    firstTeamId: r.firstTeamId ?? null,
    firstTeamName: r.firstTeamName ?? null,
    firstTeamCode: r.firstTeamCode ?? null,
    secondTeamId: r.secondTeamId ?? null,
    secondTeamName: r.secondTeamName ?? null,
    secondTeamCode: r.secondTeamCode ?? null,
    thirdTeamId: r.thirdTeamId ?? null,
    thirdTeamName: r.thirdTeamName ?? null,
    thirdTeamCode: r.thirdTeamCode ?? null,
  }));

  // Bonus predictions
  const bonusRows = (hasTopScorer || hasYellowCards)
    ? await db
        .select()
        .from(bonusPredictions)
        .where(eq(bonusPredictions.leagueId, id))
    : [];

  // Resolve team names for yellow cards bonus predictions
  const teamIds = [...new Set(bonusRows.map((p) => p.teamId).filter((t): t is string => t !== null))];
  const predTeams = teamIds.length > 0
    ? await db
        .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
        .from(teams)
        .where(inArray(teams.id, teamIds))
    : [];
  const teamMap = new Map(predTeams.map((t) => [t.id, t]));

  const bonus = bonusRows.map((p) => {
    const team = p.teamId ? teamMap.get(p.teamId) : null;
    return {
      userId: p.userId,
      type: p.type,
      value: p.type === "top_scorer" ? (p.playerName ?? "") : (team?.name ?? ""),
      flag: p.type === "most_yellow_cards" ? toFlag(team?.countryCode) : undefined,
    };
  });

  // Locked group matches + allTeams (for MemberPredictionsSection)
  let lockedMatches: {
    matchId: string;
    groupName: string | null;
    scheduledAt: string;
    homeTeamName: string;
    homeTeamCode: string | null;
    awayTeamName: string;
    awayTeamCode: string | null;
    isResultConfirmed: boolean;
    homeScore: number | null;
    awayScore: number | null;
    predictions: { userId: string; home: number; away: number }[];
  }[] = [];
  let groups: string[] = [];
  let allTeams: { id: string; name: string; countryCode: string | null }[] = [];
  let memberSlotMaps = new Map<string, Map<string, { name: string; flag: string }>>();

  if (hasMatchScores) {
    const homeTeam = alias(teams, "home_team");
    const awayTeam = alias(teams, "away_team");

    const lockedMatchRows = await db
      .select({
        matchId: matches.id,
        groupName: matches.groupName,
        scheduledAt: matches.scheduledAt,
        homeTeamName: homeTeam.name,
        homeTeamCode: homeTeam.countryCode,
        awayTeamName: awayTeam.name,
        awayTeamCode: awayTeam.countryCode,
        isResultConfirmed: matches.isResultConfirmed,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
      .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
      .where(
        and(
          eq(matches.tournamentId, league.tournamentId),
          eq(tournamentRounds.roundType, "GROUP")
        )
      )
      .orderBy(matches.scheduledAt);

    const matchPredRows =
      lockedMatchRows.length > 0
        ? await db
            .select({
              matchId: predictions.matchId,
              userId: predictions.userId,
              homeScorePred: predictions.homeScorePred,
              awayScorePred: predictions.awayScorePred,
            })
            .from(predictions)
            .where(
              and(
                inArray(predictions.matchId, lockedMatchRows.map((r) => r.matchId)),
                eq(predictions.leagueId, id)
              )
            )
        : [];

    const predsByMatch = new Map<string, { userId: string; home: number; away: number }[]>();
    for (const p of matchPredRows) {
      if (!predsByMatch.has(p.matchId)) predsByMatch.set(p.matchId, []);
      predsByMatch.get(p.matchId)!.push({ userId: p.userId, home: p.homeScorePred, away: p.awayScorePred });
    }

    // ── Per-member slot maps for knockout team resolution ─────────────────────
    // Group match rows grouped by group name
    const groupMatchesByGroup = new Map<string, typeof lockedMatchRows>();
    for (const m of lockedMatchRows) {
      if (!m.groupName) continue;
      if (!groupMatchesByGroup.has(m.groupName)) groupMatchesByGroup.set(m.groupName, []);
      groupMatchesByGroup.get(m.groupName)!.push(m);
    }
    // Per-member group prediction maps
    const memberGroupPredMaps = new Map<string, Map<string, { home: number; away: number }>>();
    for (const p of matchPredRows) {
      if (!memberGroupPredMaps.has(p.userId)) memberGroupPredMaps.set(p.userId, new Map());
      memberGroupPredMaps.get(p.userId)!.set(p.matchId, { home: p.homeScorePred, away: p.awayScorePred });
    }
    // Compute group standings → slot map per member
    for (const member of members) {
      const slotMap = new Map<string, { name: string; flag: string }>();
      const predMap = memberGroupPredMaps.get(member.userId) ?? new Map();
      const allThirds: { group: string; team: { name: string; flag: string; pts: number; gf: number; ga: number; won: number; drawn: number; lost: number; played: number } }[] = [];
      for (const [groupName, gMatches] of groupMatchesByGroup) {
        const standings = computeGroupStandings(
          gMatches.map((m) => ({
            matchId: m.matchId,
            homeTeam: m.homeTeamName,
            homeFlag: toFlag(m.homeTeamCode),
            awayTeam: m.awayTeamName,
            awayFlag: toFlag(m.awayTeamCode),
            actualHome: m.isResultConfirmed ? m.homeScore : null,
            actualAway: m.isResultConfirmed ? m.awayScore : null,
          })),
          predMap
        );
        if (standings[0]) slotMap.set(`1${groupName}`, { name: standings[0].name, flag: standings[0].flag });
        if (standings[1]) slotMap.set(`2${groupName}`, { name: standings[1].name, flag: standings[1].flag });
        if (standings[2]) allThirds.push({ group: groupName, team: standings[2] });
        if (standings[3]) slotMap.set(`4${groupName}`, { name: standings[3].name, flag: standings[3].flag });
      }
      const ranked = rankThirdPlacedTeams(allThirds);
      const top8 = ranked.slice(0, 8);
      const slotToGroup = assignThirdsToSlots(top8.map((t) => t.group));
      for (const [slot, group] of slotToGroup) {
        const entry = top8.find((t) => t.group === group);
        if (entry) slotMap.set(slot, { name: entry.team.name, flag: entry.team.flag });
      }
      memberSlotMaps.set(member.userId, slotMap);
    }

    lockedMatches = lockedMatchRows.map((r) => ({
      matchId: r.matchId,
      groupName: r.groupName,
      scheduledAt: r.scheduledAt.toISOString(),
      homeTeamName: r.homeTeamName,
      homeTeamCode: r.homeTeamCode,
      awayTeamName: r.awayTeamName,
      awayTeamCode: r.awayTeamCode,
      isResultConfirmed: r.isResultConfirmed,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      predictions: predsByMatch.get(r.matchId) ?? [],
    }));

    const allGroupRows = await db
      .selectDistinct({ groupName: matches.groupName })
      .from(matches)
      .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
      .where(
        and(
          eq(matches.tournamentId, league.tournamentId),
          eq(tournamentRounds.roundType, "GROUP")
        )
      );
    groups = allGroupRows
      .map((r) => r.groupName)
      .filter((g): g is string => g !== null)
      .sort();
  }

  // Knockout matches (for SLUTSPEL comparison section)
  const KNOCKOUT_ROUND_TYPES = ["ROUND_OF_32", "ROUND_OF_16", "QF", "SF", "FINAL"];
  const ROUND_NAME_DISPLAY: Record<string, string> = {
    ROUND_OF_32: "Sextondelsfinaler",
    ROUND_OF_16: "Åttondelsfinaler",
    QF: "Kvartsfinal",
    SF: "Semifinal",
    FINAL: "Final",
  };

  let knockoutMatches: {
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
  }[] = [];
  let knockoutRounds: { roundType: string; roundName: string }[] = [];

  if (hasMatchScores) {
    const knockoutRoundRows = await db
      .select()
      .from(tournamentRounds)
      .where(
        and(
          eq(tournamentRounds.tournamentId, league.tournamentId),
          inArray(tournamentRounds.roundType, KNOCKOUT_ROUND_TYPES)
        )
      )
      .orderBy(tournamentRounds.sequenceOrder);

    if (knockoutRoundRows.length > 0) {
      const knockoutRoundIds = knockoutRoundRows.map((r) => r.id);
      const htAlias = alias(teams, "ht");
      const atAlias = alias(teams, "at");

      const knockoutMatchRows = await db
        .select({
          matchId: matches.id,
          roundId: matches.roundId,
          matchNumber: matches.matchNumber,
          scheduledAt: matches.scheduledAt,
          venue: matches.venue,
          homeTeamName: htAlias.name,
          homeTeamCode: htAlias.countryCode,
          awayTeamName: atAlias.name,
          awayTeamCode: atAlias.countryCode,
          isResultConfirmed: matches.isResultConfirmed,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
        })
        .from(matches)
        .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
        .leftJoin(htAlias, eq(matches.homeTeamId, htAlias.id))
        .leftJoin(atAlias, eq(matches.awayTeamId, atAlias.id))
        .where(inArray(matches.roundId, knockoutRoundIds))
        .orderBy(tournamentRounds.sequenceOrder, matches.matchNumber);

      // Fetch ALL league member predictions for knockout matches
      const knockoutMatchIds = knockoutMatchRows.map((r) => r.matchId);
      const knockoutPredRows = knockoutMatchIds.length > 0
        ? await db
            .select({
              matchId: predictions.matchId,
              userId: predictions.userId,
              homeScorePred: predictions.homeScorePred,
              awayScorePred: predictions.awayScorePred,
              homeExtraTimePred: predictions.homeExtraTimePred,
              awayExtraTimePred: predictions.awayExtraTimePred,
              homePenaltyPred: predictions.homePenaltyPred,
              awayPenaltyPred: predictions.awayPenaltyPred,
            })
            .from(predictions)
            .where(
              and(
                inArray(predictions.matchId, knockoutMatchIds),
                eq(predictions.leagueId, id)
              )
            )
        : [];

      type KoPred = {
        userId: string; home: number; away: number;
        homeET: number | null; awayET: number | null;
        homePen: number | null; awayPen: number | null;
      };
      const koPredsByMatch = new Map<string, KoPred[]>();
      const memberKoPredMaps = new Map<string, Map<string, KoPred>>();
      for (const p of knockoutPredRows) {
        const kp: KoPred = {
          userId: p.userId,
          home: p.homeScorePred,
          away: p.awayScorePred,
          homeET: p.homeExtraTimePred ?? null,
          awayET: p.awayExtraTimePred ?? null,
          homePen: p.homePenaltyPred ?? null,
          awayPen: p.awayPenaltyPred ?? null,
        };
        if (!koPredsByMatch.has(p.matchId)) koPredsByMatch.set(p.matchId, []);
        koPredsByMatch.get(p.matchId)!.push(kp);
        if (!memberKoPredMaps.has(p.userId)) memberKoPredMaps.set(p.userId, new Map());
        memberKoPredMaps.get(p.userId)!.set(p.matchId, kp);
      }

      // Round rows keyed by id for fast lookup
      const roundById = new Map(knockoutRoundRows.map((r) => [r.id, r]));

      // Parse venue JSON for slot labels when team isn't set yet
      function slotLabel(slot: string | null): string {
        if (!slot) return "TBD";
        if (/^[123][A-L]/.test(slot)) {
          const pos = slot[0] === "1" ? "Etta" : slot[0] === "2" ? "Tvåa" : "Trea";
          return `${pos} ${slot.slice(1)}`;
        }
        if (slot.startsWith("VM")) return `V. match ${slot.slice(2)}`;
        if (slot.startsWith("VK")) return `V. kvartsfinalmatch ${slot.slice(2)}`;
        if (slot.startsWith("VS")) return `V. semifinal ${slot.slice(2)}`;
        return slot;
      }

      // The winner of a knockout match populates a downstream slot
      function winnerSlotForRound(roundType: string, matchNumber: number): string | null {
        if (roundType === "ROUND_OF_32" || roundType === "ROUND_OF_16") return `VM${matchNumber}`;
        if (roundType === "QF") return `VK${matchNumber}`;
        if (roundType === "SF") return `VS${matchNumber}`;
        return null;
      }

      // Chain-resolve knockout slots per member.
      // knockoutMatchRows is already sorted by round sequence + match number, so
      // each match's winner slot is available for downstream matches.
      type TeamRef = { name: string; flag: string };
      const matchResolvedTeams = new Map<string, Map<string, { home: TeamRef | null; away: TeamRef | null }>>();

      for (const kMatch of knockoutMatchRows) {
        const round = roundById.get(kMatch.roundId)!;
        const winnerSlot = winnerSlotForRound(round.roundType, kMatch.matchNumber ?? 0);
        let homeSlot: string | null = null;
        let awaySlot: string | null = null;
        if (kMatch.venue) {
          try { const v = JSON.parse(kMatch.venue); homeSlot = v.homeSlot ?? null; awaySlot = v.awaySlot ?? null; } catch { /* */ }
        }
        const perUser = new Map<string, { home: TeamRef | null; away: TeamRef | null }>();
        for (const member of members) {
          const slotMap = memberSlotMaps.get(member.userId) ?? new Map<string, TeamRef>();
          // If the actual team is confirmed, use that; otherwise resolve from this member's slot map
          const homeTeam: TeamRef | null = kMatch.homeTeamName
            ? { name: kMatch.homeTeamName, flag: toFlag(kMatch.homeTeamCode) }
            : (homeSlot ? slotMap.get(homeSlot) ?? null : null);
          const awayTeam: TeamRef | null = kMatch.awayTeamName
            ? { name: kMatch.awayTeamName, flag: toFlag(kMatch.awayTeamCode) }
            : (awaySlot ? slotMap.get(awaySlot) ?? null : null);
          perUser.set(member.userId, { home: homeTeam, away: awayTeam });
          // Determine predicted winner and extend slot map for downstream rounds
          if (winnerSlot) {
            const koPred = memberKoPredMaps.get(member.userId)?.get(kMatch.matchId);
            if (koPred) {
              const isHome = predWinnerIsHome({
                home: koPred.home, away: koPred.away,
                homeET: koPred.homeET, awayET: koPred.awayET,
                homePen: koPred.homePen, awayPen: koPred.awayPen,
              });
              if (isHome !== null) {
                const winner = isHome ? homeTeam : awayTeam;
                if (winner) slotMap.set(winnerSlot, winner);
              }
            }
          }
        }
        matchResolvedTeams.set(kMatch.matchId, perUser);
      }

      knockoutMatches = knockoutMatchRows.map((r) => {
        let homeSlot: string | null = null;
        let awaySlot: string | null = null;
        if (r.venue) {
          try {
            const v = JSON.parse(r.venue);
            homeSlot = v.homeSlot ?? null;
            awaySlot = v.awaySlot ?? null;
          } catch { /* ignore */ }
        }
        const round = roundById.get(r.roundId)!;
        const perUser = matchResolvedTeams.get(r.matchId);
        return {
          matchId: r.matchId,
          roundType: round.roundType,
          roundName: ROUND_NAME_DISPLAY[round.roundType] ?? round.name,
          matchNumber: r.matchNumber ?? 0,
          scheduledAt: r.scheduledAt.toISOString(),
          homeTeamName: r.homeTeamName ?? slotLabel(homeSlot),
          homeTeamCode: r.homeTeamCode ?? null,
          awayTeamName: r.awayTeamName ?? slotLabel(awaySlot),
          awayTeamCode: r.awayTeamCode ?? null,
          isResultConfirmed: r.isResultConfirmed,
          homeScore: r.homeScore,
          awayScore: r.awayScore,
          predictions: (koPredsByMatch.get(r.matchId) ?? []).map((p) => ({
            ...p,
            resolvedHome: perUser?.get(p.userId)?.home ?? null,
            resolvedAway: perUser?.get(p.userId)?.away ?? null,
          })),
        };
      });

      knockoutRounds = knockoutRoundRows.map((r) => ({
        roundType: r.roundType,
        roundName: ROUND_NAME_DISPLAY[r.roundType] ?? r.name,
      }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jämför tips</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Se hur deltagarnas VM-tips skiljer sig åt.
        </p>
      </div>
      <CompareView
        currentUserId={dbUser?.id ?? null}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          email: m.email,
          avatarUrl: m.avatarUrl ?? null,
        }))}
        top3={top3}
        bonus={bonus}
        hasTopScorer={hasTopScorer}
        hasYellowCards={hasYellowCards}
      />
      {hasMatchScores && (
        <MemberPredictionsSection
          leagueId={id}
          currentUserId={dbUser?.id ?? null}
          hasMatchScores={hasMatchScores}
          hideTop3
          members={members.map((m) => ({
            userId: m.userId,
            displayName: m.displayName,
            email: m.email,
            avatarUrl: m.avatarUrl ?? null,
          }))}
          lockedMatches={lockedMatches}
          top3={top3ForSection}
          allTeams={allTeams}
          groups={groups}
          knockoutMatches={knockoutMatches}
          knockoutRounds={knockoutRounds}
        />
      )}
    </div>
  );
}
