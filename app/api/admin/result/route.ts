import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  matches,
  predictions,
  predictionRules,
  pointSnapshots,
  notifications,
  users,
  teams,
} from "@/lib/db/schema";
import { calcPoints } from "@/lib/predictor/points";
import { redis, keys } from "@/lib/redis";
// keys.eventsChannel is the unified channel (leaderboardChannel is an alias)
import { cookies } from "next/headers";

async function isAuthorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get("admin_session")?.value === process.env.ADMIN_SECRET;
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { matchId: string; homeScore: number; awayScore: number };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { matchId, homeScore, awayScore } = body;
  if (
    typeof matchId !== "string" ||
    typeof homeScore !== "number" ||
    typeof awayScore !== "number" ||
    homeScore < 0 ||
    awayScore < 0 ||
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore)
  ) {
    return new Response("Invalid input", { status: 400 });
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return new Response("Match not found", { status: 404 });

  const teamIds = [match.homeTeamId, match.awayTeamId].filter((id): id is string => id !== null);
  const teamRows = teamIds.length > 0
    ? await db.select({ id: teams.id, name: teams.name, shortName: teams.shortName }).from(teams).where(inArray(teams.id, teamIds))
    : [];
  const teamMap = new Map(teamRows.map((t) => [t.id, t.shortName ?? t.name]));
  const homeTeamName = match.homeTeamId ? (teamMap.get(match.homeTeamId) ?? "Hemmalag") : "Hemmalag";
  const awayTeamName = match.awayTeamId ? (teamMap.get(match.awayTeamId) ?? "Bortalag") : "Bortalag";

  await db
    .update(matches)
    .set({ homeScore, awayScore, isResultConfirmed: true, status: "completed", updatedAt: new Date() })
    .where(eq(matches.id, matchId));

  const [rules] = await db
    .select()
    .from(predictionRules)
    .where(eq(predictionRules.tournamentId, match.tournamentId))
    .limit(1);

  const pointRules = {
    pointsExactScore: rules?.pointsExactScore ?? 3,
    pointsCorrectWinner: rules?.pointsCorrectWinner ?? 1,
    pointsCorrectDraw: rules?.pointsCorrectDraw ?? 1,
  };

  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId));

  if (matchPredictions.length === 0) {
    return Response.json({ ok: true, pointsAwarded: 0 });
  }

  let totalAwarded = 0;
  const predictionResultNotifs: { userId: string; payload: Record<string, unknown> }[] = [];

  for (const pred of matchPredictions) {
    // Skip predictions not scoped to a league (legacy global predictions)
    if (!pred.leagueId) continue;

    const pts = calcPoints(
      { home: pred.homeScorePred, away: pred.awayScorePred },
      { home: homeScore, away: awayScore },
      pointRules
    );
    totalAwarded += pts;

    predictionResultNotifs.push({
      userId: pred.userId,
      payload: {
        leagueId: pred.leagueId,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        homePred: pred.homeScorePred,
        awayPred: pred.awayScorePred,
        points: pts,
        isExact: pts === pointRules.pointsExactScore && pts > 0,
      },
    });

    {
      const leagueId = pred.leagueId;
      const isExact = pts === pointRules.pointsExactScore;
      const isCorrect = pts === pointRules.pointsCorrectWinner || pts === pointRules.pointsCorrectDraw;

      await db
        .insert(pointSnapshots)
        .values({
          userId: pred.userId,
          leagueId,
          tournamentId: match.tournamentId,
          totalPoints: pts,
          matchesPlayed: 1,
          exactScores: isExact ? 1 : 0,
          correctWinners: isCorrect ? 1 : 0,
          lastMatchId: matchId,
        })
        .onConflictDoUpdate({
          target: [pointSnapshots.userId, pointSnapshots.leagueId],
          set: {
            totalPoints: sql`point_snapshots.total_points + ${pts}`,
            matchesPlayed: sql`point_snapshots.matches_played + 1`,
            exactScores: sql`point_snapshots.exact_scores + ${isExact ? 1 : 0}`,
            correctWinners: sql`point_snapshots.correct_winners + ${isCorrect ? 1 : 0}`,
            lastMatchId: matchId,
            computedAt: new Date(),
          },
        });
    }
  }

  if (predictionResultNotifs.length > 0) {
    await db.insert(notifications).values(
      predictionResultNotifs.map((n) => ({
        userId: n.userId,
        type: "prediction_result" as const,
        payload: n.payload,
      }))
    );
  }

  const affectedLeagueIds = [...new Set(
    matchPredictions.map((p) => p.leagueId).filter((id): id is string => id !== null)
  )];

  for (const leagueId of affectedLeagueIds) {
    // Snapshot BEFORE rank update to detect rank changes
    const before = await db
      .select({ userId: pointSnapshots.userId, rankInLeague: pointSnapshots.rankInLeague })
      .from(pointSnapshots)
      .where(eq(pointSnapshots.leagueId, leagueId));
    const rankBefore = new Map(before.map((r) => [r.userId, r.rankInLeague]));

    const snapshots = await db
      .select({
        userId: pointSnapshots.userId,
        totalPoints: pointSnapshots.totalPoints,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(pointSnapshots)
      .innerJoin(users, eq(pointSnapshots.userId, users.id))
      .where(eq(pointSnapshots.leagueId, leagueId));

    const sorted = [...snapshots].sort((a, b) => b.totalPoints - a.totalPoints);

    // Update ranks
    for (let i = 0; i < sorted.length; i++) {
      await db
        .update(pointSnapshots)
        .set({ rankInLeague: i + 1 })
        .where(and(eq(pointSnapshots.userId, sorted[i].userId), eq(pointSnapshots.leagueId, leagueId)));
    }

    // Detect rank changes → create notifications for overtaken users
    const overtakenNotifications: {
      userId: string;
      type: string;
      payload: Record<string, unknown>;
    }[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const newRank = i + 1;
      const oldRank = rankBefore.get(sorted[i].userId);
      // Was previously ranked higher (lower number) and is now worse
      if (oldRank !== null && oldRank !== undefined && newRank > oldRank) {
        // Find who overtook them (the person now at their old rank)
        const overtaker = sorted[oldRank - 1];
        overtakenNotifications.push({
          userId: sorted[i].userId,
          type: "rank_overtaken",
          payload: {
            leagueId,
            newRank,
            oldRank,
            overtakerName: overtaker?.displayName ?? overtaker?.email?.split("@")[0] ?? "Någon",
          },
        });
      }
    }

    if (overtakenNotifications.length > 0) {
      await db.insert(notifications).values(
        overtakenNotifications.map((n) => ({
          userId: n.userId,
          type: n.type,
          payload: n.payload,
        }))
      );
    }

    // Sync Redis sorted set
    const zaddArgs: (string | number)[] = [];
    for (const s of sorted) {
      zaddArgs.push(s.totalPoints, JSON.stringify({ userId: s.userId, displayName: s.displayName, email: s.email, avatarUrl: s.avatarUrl ?? null }));
    }
    if (zaddArgs.length > 0) {
      await redis.zadd(keys.leaderboard(leagueId), ...zaddArgs);
      await redis.expire(keys.leaderboard(leagueId), 60 * 60 * 24 * 7);
    }

    await redis.publish(
      keys.eventsChannel(leagueId),
      JSON.stringify({ type: "leaderboard_updated", leagueId, matchId, updatedAt: new Date().toISOString() })
    );
  }

  return Response.json({ ok: true, pointsAwarded: totalAwarded, predictions: matchPredictions.length });
}
