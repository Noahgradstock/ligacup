import { eq, inArray, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  matches,
  teams,
  tournamentRounds,
  tournaments,
  predictions,
  leagues,
  leagueMembers,
} from "@/lib/db/schema";
import { PredictionsView } from "@/components/predictions-view";
import { syncCurrentUser } from "@/lib/sync-user";
import { calcPoints } from "@/lib/predictor/points";

function toFlag(code: string | null) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default async function LeaguePredictionsPage({
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

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  // Only group stage matches on this page
  const rows = await db
    .select({
      match: matches,
      round: tournamentRounds,
      homeTeam: { name: homeTeam.name, countryCode: homeTeam.countryCode },
      awayTeam: { name: awayTeam.name, countryCode: awayTeam.countryCode },
    })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(
      and(
        eq(tournaments.id, league.tournamentId),
        eq(tournamentRounds.roundType, "GROUP")
      )
    )
    .orderBy(matches.scheduledAt);

  const predMap = new Map<string, { home: number; away: number }>();
  if (dbUser && rows.length > 0) {
    const matchIds = rows.map((r) => r.match.id);
    const preds = await db
      .select()
      .from(predictions)
      .where(
        and(
          inArray(predictions.matchId, matchIds),
          eq(predictions.leagueId, id),
          eq(predictions.userId, dbUser.id)
        )
      );
    for (const p of preds) {
      predMap.set(p.matchId, { home: p.homeScorePred, away: p.awayScorePred });
    }
  }

  const now = new Date();
  const groups = [...new Set(rows.map((r) => r.match.groupName ?? "").filter(Boolean))].sort();
  const defaultRules = { pointsExactScore: 3, pointsCorrectWinner: 1, pointsCorrectDraw: 1 };

  const matchData = rows.map(({ match, homeTeam: ht, awayTeam: at }) => {
    const pred = predMap.get(match.id) ?? null;
    const hasResult = match.isResultConfirmed && match.homeScore !== null && match.awayScore !== null;
    const pointsEarned = hasResult && pred
      ? calcPoints(
          { home: pred.home, away: pred.away },
          { home: match.homeScore!, away: match.awayScore! },
          defaultRules
        )
      : null;
    return {
      matchId: match.id,
      leagueId: id,
      homeTeam: ht.name,
      homeFlag: toFlag(ht.countryCode),
      awayTeam: at.name,
      awayFlag: toFlag(at.countryCode),
      scheduledAt: match.scheduledAt.toISOString(),
      groupName: match.groupName ?? "",
      existingHome: pred?.home ?? null,
      existingAway: pred?.away ?? null,
      isLocked: now >= match.scheduledAt,
      actualHome: hasResult ? match.homeScore! : null,
      actualAway: hasResult ? match.awayScore! : null,
      pointsEarned,
    };
  });

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tippa matcherna</h1>
        <p className="text-muted-foreground text-sm mt-1">
          3p för exakt resultat · 1p för rätt vinnare/oavgjort
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Inga matcher hittades.</p>
      ) : (
        <PredictionsView matches={matchData} groups={groups} leagueId={id} />
      )}
    </div>
  );
}
