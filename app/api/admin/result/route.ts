import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  matches,
  predictions,
  predictionRules,
  leagueMembers,
  pointSnapshots,
} from "@/lib/db/schema";
import { calcPoints } from "@/lib/predictor/points";
import { redis, keys } from "@/lib/redis";
import { cookies } from "next/headers";
import { users } from "@/lib/db/schema";

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

  // Fetch match
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return new Response("Match not found", { status: 404 });

  // Update match result
  await db
    .update(matches)
    .set({
      homeScore,
      awayScore,
      isResultConfirmed: true,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId));

  // Fetch prediction rules for this tournament
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

  // Fetch all predictions for this match
  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId));

  if (matchPredictions.length === 0) {
    return Response.json({ ok: true, pointsAwarded: 0 });
  }

  const userIds = matchPredictions.map((p) => p.userId);

  // Fetch all league memberships for these users in this tournament
  const memberships = await db
    .select({
      userId: leagueMembers.userId,
      leagueId: leagueMembers.leagueId,
    })
    .from(leagueMembers)
    .where(
      and(
        inArray(leagueMembers.userId, userIds),
        eq(leagueMembers.isActive, true)
      )
    );

  // Build lookup: userId → leagueIds[]
  const userLeagues = new Map<string, string[]>();
  for (const m of memberships) {
    if (!userLeagues.has(m.userId)) userLeagues.set(m.userId, []);
    userLeagues.get(m.userId)!.push(m.leagueId);
  }

  // Calculate and upsert point_snapshots for each (user, league)
  let totalAwarded = 0;

  for (const pred of matchPredictions) {
    const pts = calcPoints(
      { home: pred.homeScorePred, away: pred.awayScorePred },
      { home: homeScore, away: awayScore },
      pointRules
    );
    totalAwarded += pts;

    const leagues = userLeagues.get(pred.userId) ?? [];
    for (const leagueId of leagues) {
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

  // Recalculate ranks + sync Redis sorted set per affected league
  const affectedLeagueIds = [...new Set(memberships.map((m) => m.leagueId))];

  for (const leagueId of affectedLeagueIds) {
    const snapshots = await db
      .select({
        userId: pointSnapshots.userId,
        totalPoints: pointSnapshots.totalPoints,
        displayName: users.displayName,
        email: users.email,
      })
      .from(pointSnapshots)
      .innerJoin(users, eq(pointSnapshots.userId, users.id))
      .where(eq(pointSnapshots.leagueId, leagueId));

    const sorted = [...snapshots].sort((a, b) => b.totalPoints - a.totalPoints);

    // Update ranks in Postgres
    for (let i = 0; i < sorted.length; i++) {
      await db
        .update(pointSnapshots)
        .set({ rankInLeague: i + 1 })
        .where(
          and(
            eq(pointSnapshots.userId, sorted[i].userId),
            eq(pointSnapshots.leagueId, leagueId)
          )
        );
    }

    // Sync Redis sorted set — ZADD with member = JSON blob for O(1) leaderboard reads
    const leaderboardKey = keys.leaderboard(leagueId);
    const zaddArgs: (string | number)[] = [];
    for (const s of sorted) {
      zaddArgs.push(
        s.totalPoints,
        JSON.stringify({
          userId: s.userId,
          displayName: s.displayName,
          email: s.email,
        })
      );
    }
    if (zaddArgs.length > 0) {
      await redis.zadd(leaderboardKey, ...zaddArgs);
      await redis.expire(leaderboardKey, 60 * 60 * 24 * 7); // 7 days TTL
    }

    // Publish SSE event to all connected clients for this league
    await redis.publish(
      keys.leaderboardChannel(leagueId),
      JSON.stringify({ leagueId, matchId, updatedAt: new Date().toISOString() })
    );
  }

  return Response.json({ ok: true, pointsAwarded: totalAwarded, predictions: matchPredictions.length });
}
