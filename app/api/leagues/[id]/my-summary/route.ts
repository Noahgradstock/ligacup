import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  users,
  leagues,
  leagueMembers,
  matches,
  tournamentRounds,
  predictions,
  bonusPredictions,
  teams,
} from "@/lib/db/schema";
import { predWinnerIsHome } from "@/lib/predictor/winner";
import { computeGroupStandings, rankThirdPlacedTeams, assignThirdsToSlots } from "@/lib/predictor/standings";

function toFlag(code: string | null | undefined) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function parseVenueSlots(venue: string | null): { homeSlot: string | null; awaySlot: string | null } {
  if (!venue) return { homeSlot: null, awaySlot: null };
  try {
    const parsed = JSON.parse(venue);
    return { homeSlot: parsed.homeSlot ?? null, awaySlot: parsed.awaySlot ?? null };
  } catch {
    return { homeSlot: null, awaySlot: null };
  }
}

const KNOCKOUT_ROUND_TYPES = ["ROUND_OF_32", "ROUND_OF_16", "QF", "SF", "FINAL", "THIRD_PLACE"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return new Response("User not found", { status: 404 });

  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) return new Response("League not found", { status: 404 });

  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, id), eq(leagueMembers.userId, user.id), eq(leagueMembers.isActive, true)))
    .limit(1);
  if (!membership) return new Response("Not a member", { status: 403 });

  const config = league.configJson as { features?: string[] } | null;
  const features = config?.features ?? [];
  const hasTopScorer = features.includes("top_scorer");

  // ── Gate: all group matches tipped ───────────────────────────────────────
  const groupMatchRows = await db
    .select({ id: matches.id, scheduledAt: matches.scheduledAt })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .where(
      and(
        eq(matches.tournamentId, league.tournamentId),
        eq(tournamentRounds.roundType, "GROUP")
      )
    );

  const groupPredRows = groupMatchRows.length > 0
    ? await db
        .select({ matchId: predictions.matchId })
        .from(predictions)
        .where(
          and(
            inArray(predictions.matchId, groupMatchRows.map((m) => m.id)),
            eq(predictions.leagueId, id),
            eq(predictions.userId, user.id)
          )
        )
    : [];

  const tippedGroupIds = new Set(groupPredRows.map((p) => p.matchId));
  const now = new Date();
  const lockedWithoutPred = groupMatchRows.filter(
    (m) => now >= m.scheduledAt && !tippedGroupIds.has(m.id)
  ).length;
  const required = groupMatchRows.length - lockedWithoutPred;
  const groupComplete = groupPredRows.length >= required;

  // ── Build slot→team map from group predictions ────────────────────────────
  const slotTeamMap = new Map<string, { name: string; flag: string }>();

  if (groupComplete) {
    const homeTeamAlias = alias(teams, "home_team");
    const awayTeamAlias = alias(teams, "away_team");

    const groupDetailRows = await db
      .select({
        matchId: matches.id,
        groupName: matches.groupName,
        homeTeamName: homeTeamAlias.name,
        homeTeamCode: homeTeamAlias.countryCode,
        awayTeamName: awayTeamAlias.name,
        awayTeamCode: awayTeamAlias.countryCode,
        actualHome: matches.homeScore,
        actualAway: matches.awayScore,
        isResultConfirmed: matches.isResultConfirmed,
      })
      .from(matches)
      .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
      .innerJoin(homeTeamAlias, eq(matches.homeTeamId, homeTeamAlias.id))
      .innerJoin(awayTeamAlias, eq(matches.awayTeamId, awayTeamAlias.id))
      .where(
        and(
          eq(matches.tournamentId, league.tournamentId),
          eq(tournamentRounds.roundType, "GROUP")
        )
      );

    const groupMatchIds = groupDetailRows.map((r) => r.matchId);
    const groupPreds = groupMatchIds.length > 0
      ? await db
          .select()
          .from(predictions)
          .where(
            and(
              inArray(predictions.matchId, groupMatchIds),
              eq(predictions.leagueId, id),
              eq(predictions.userId, user.id)
            )
          )
      : [];

    const predMap = new Map(
      groupPreds.map((p) => [p.matchId, { home: p.homeScorePred, away: p.awayScorePred }])
    );

    const byGroup = new Map<string, typeof groupDetailRows>();
    for (const r of groupDetailRows) {
      if (!r.groupName) continue;
      if (!byGroup.has(r.groupName)) byGroup.set(r.groupName, []);
      byGroup.get(r.groupName)!.push(r);
    }

    const allThirds: Array<{ group: string; team: { name: string; flag: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; pts: number } }> = [];
    for (const [groupName, gMatches] of byGroup.entries()) {
      const standings = computeGroupStandings(
        gMatches.map((m) => ({
          matchId: m.matchId,
          homeTeam: m.homeTeamName,
          homeFlag: toFlag(m.homeTeamCode),
          awayTeam: m.awayTeamName,
          awayFlag: toFlag(m.awayTeamCode),
          actualHome: m.isResultConfirmed ? m.actualHome : null,
          actualAway: m.isResultConfirmed ? m.actualAway : null,
        })),
        predMap
      );
      if (standings[0]) slotTeamMap.set(`1${groupName}`, standings[0]);
      if (standings[1]) slotTeamMap.set(`2${groupName}`, standings[1]);
      if (standings[2]) allThirds.push({ group: groupName, team: standings[2] });
    }

    const top8Thirds = rankThirdPlacedTeams(allThirds).slice(0, 8);
    const slotToGroup = assignThirdsToSlots(top8Thirds.map((t) => t.group));
    for (const [slot, group] of slotToGroup.entries()) {
      const entry = top8Thirds.find((t) => t.group === group);
      if (entry) slotTeamMap.set(slot, entry.team);
    }
  }

  // ── Knockout predictions → derive top 3 ──────────────────────────────────
  const knockoutRounds = await db
    .select()
    .from(tournamentRounds)
    .where(
      and(
        eq(tournamentRounds.tournamentId, league.tournamentId),
        inArray(tournamentRounds.roundType, KNOCKOUT_ROUND_TYPES)
      )
    )
    .orderBy(tournamentRounds.sequenceOrder);

  let top3: { first: { name: string; flag: string } | null; second: { name: string; flag: string } | null; third: { name: string; flag: string } | null } | null = null;

  if (knockoutRounds.length > 0) {
    const roundIds = knockoutRounds.map((r) => r.id);
    const homeTeam = alias(teams, "home_team");
    const awayTeam = alias(teams, "away_team");

    const koRows = await db
      .select({
        match: matches,
        round: tournamentRounds,
        homeTeamName: homeTeam.name,
        homeTeamCode: homeTeam.countryCode,
        awayTeamName: awayTeam.name,
        awayTeamCode: awayTeam.countryCode,
      })
      .from(matches)
      .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
      .leftJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .leftJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
      .where(inArray(matches.roundId, roundIds))
      .orderBy(tournamentRounds.sequenceOrder, matches.matchNumber);

    const koMatchIds = koRows.map((r) => r.match.id);
    const koPreds = koMatchIds.length > 0
      ? await db
          .select()
          .from(predictions)
          .where(
            and(
              inArray(predictions.matchId, koMatchIds),
              eq(predictions.leagueId, id),
              eq(predictions.userId, user.id)
            )
          )
      : [];

    const koPredMap = new Map(
      koPreds.map((p) => [p.matchId, {
        home: p.homeScorePred,
        away: p.awayScorePred,
        homeET: p.homeExtraTimePred,
        awayET: p.awayExtraTimePred,
        homePen: p.homePenaltyPred,
        awayPen: p.awayPenaltyPred,
      }])
    );

    // Build slotTeamMap by chaining winners through rounds
    for (const { match, round, homeTeamName, homeTeamCode, awayTeamName, awayTeamCode } of koRows) {
      const pred = koPredMap.get(match.id);
      if (!pred || match.matchNumber === null) continue;

      const { homeSlot, awaySlot } = parseVenueSlots(match.venue);
      const resolvedHome = homeTeamName
        ? { name: homeTeamName, flag: toFlag(homeTeamCode) }
        : homeSlot ? (slotTeamMap.get(homeSlot) ?? null) : null;
      const resolvedAway = awayTeamName
        ? { name: awayTeamName, flag: toFlag(awayTeamCode) }
        : awaySlot ? (slotTeamMap.get(awaySlot) ?? null) : null;

      const winnerIsHome = predWinnerIsHome(pred);
      if (winnerIsHome === null) continue;
      const winner = winnerIsHome ? resolvedHome : resolvedAway;
      if (!winner) continue;

      const prefix = round.roundType === "QF" ? "VK"
                   : round.roundType === "SF" ? "VS"
                   : "VM";
      slotTeamMap.set(`${prefix}${match.matchNumber}`, winner);

      if (round.roundType === "SF") {
        const loser = winnerIsHome ? resolvedAway : resolvedHome;
        if (loser) slotTeamMap.set(`VB${match.matchNumber}`, loser);
      }
    }

    // Extract top 3 from Final + Third Place
    const finalRound = knockoutRounds.find((r) => r.roundType === "FINAL");
    const bronzeRound = knockoutRounds.find((r) => r.roundType === "THIRD_PLACE");
    const finalMatch = finalRound ? koRows.find((r) => r.round.id === finalRound.id) : null;
    const bronzeMatch = bronzeRound ? koRows.find((r) => r.round.id === bronzeRound.id) : null;

    if (finalMatch) {
      const pred = koPredMap.get(finalMatch.match.id);
      if (pred) {
        const winnerIsHome = predWinnerIsHome(pred);
        if (winnerIsHome !== null) {
          const { homeSlot, awaySlot } = parseVenueSlots(finalMatch.match.venue);
          const resolvedHome = finalMatch.homeTeamName
            ? { name: finalMatch.homeTeamName, flag: toFlag(finalMatch.homeTeamCode) }
            : homeSlot ? (slotTeamMap.get(homeSlot) ?? null) : null;
          const resolvedAway = finalMatch.awayTeamName
            ? { name: finalMatch.awayTeamName, flag: toFlag(finalMatch.awayTeamCode) }
            : awaySlot ? (slotTeamMap.get(awaySlot) ?? null) : null;

          const first = winnerIsHome ? resolvedHome : resolvedAway;
          const second = winnerIsHome ? resolvedAway : resolvedHome;

          let third: { name: string; flag: string } | null = null;
          if (bronzeMatch) {
            const bPred = koPredMap.get(bronzeMatch.match.id);
            if (bPred) {
              const bWinnerIsHome = predWinnerIsHome(bPred);
              if (bWinnerIsHome !== null) {
                const { homeSlot: bHomeSlot, awaySlot: bAwaySlot } = parseVenueSlots(bronzeMatch.match.venue);
                const bHome = bronzeMatch.homeTeamName
                  ? { name: bronzeMatch.homeTeamName, flag: toFlag(bronzeMatch.homeTeamCode) }
                  : bHomeSlot ? (slotTeamMap.get(bHomeSlot) ?? null) : null;
                const bAway = bronzeMatch.awayTeamName
                  ? { name: bronzeMatch.awayTeamName, flag: toFlag(bronzeMatch.awayTeamCode) }
                  : bAwaySlot ? (slotTeamMap.get(bAwaySlot) ?? null) : null;
                third = bWinnerIsHome ? bHome : bAway;
              }
            }
          }

          top3 = { first, second, third };
        }
      }
    }
  }

  // ── Bonus: top scorer ─────────────────────────────────────────────────────
  let topScorer: string | null = null;
  if (hasTopScorer) {
    const [bonusPred] = await db
      .select()
      .from(bonusPredictions)
      .where(
        and(
          eq(bonusPredictions.userId, user.id),
          eq(bonusPredictions.leagueId, id),
          eq(bonusPredictions.type, "top_scorer")
        )
      )
      .limit(1);
    topScorer = bonusPred?.playerName ?? null;
  }

  // ── Completeness check ────────────────────────────────────────────────────
  const hasTop3 = top3?.first !== null && top3 !== null;
  const hasScorerIfNeeded = !hasTopScorer || topScorer !== null;
  const allTipped = groupComplete && hasTop3 && hasScorerIfNeeded;

  return Response.json({
    allTipped,
    top3,
    topScorer,
    hasTopScorer,
  });
}
