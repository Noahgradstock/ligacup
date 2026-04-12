export const dynamic = "force-dynamic";

import { eq, and, inArray, lt } from "drizzle-orm";
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

  if (hasMatchScores) {
    const homeTeam = alias(teams, "home_team");
    const awayTeam = alias(teams, "away_team");
    const now = new Date();

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
          eq(tournamentRounds.roundType, "GROUP"),
          lt(matches.scheduledAt, now)
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
        />
      )}
    </div>
  );
}
