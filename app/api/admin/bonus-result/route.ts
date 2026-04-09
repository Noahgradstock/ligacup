import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bonusPredictions,
  tournamentBonusResults,
  pointSnapshots,
  notifications,
  teams,
  leagues,
  users,
} from "@/lib/db/schema";
import { redis, keys } from "@/lib/redis";
import { cookies } from "next/headers";

async function isAuthorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get("admin_session")?.value === process.env.ADMIN_SECRET;
}

const VALID_TYPES = ["top_scorer", "most_yellow_cards"] as const;
type BonusType = (typeof VALID_TYPES)[number];

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { tournamentId: string; type: string; playerName?: string; teamId?: string; pointsAwarded?: number };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { tournamentId, type, playerName, teamId, pointsAwarded: customPoints } = body;

  if (!tournamentId || !VALID_TYPES.includes(type as BonusType)) {
    return new Response("Invalid input", { status: 400 });
  }

  if (type === "top_scorer" && (!playerName || playerName.trim().length < 2)) {
    return new Response("playerName required for top_scorer", { status: 400 });
  }
  if (type === "most_yellow_cards" && !teamId) {
    return new Response("teamId required for most_yellow_cards", { status: 400 });
  }

  // Validate team exists
  if (teamId) {
    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return new Response("Team not found", { status: 404 });
  }

  // Determine pointsAwarded: use custom if provided, else look up from league config (use first league for this tournament)
  let pointsAwarded = customPoints ?? 5;
  if (!customPoints) {
    const [anyLeague] = await db
      .select({ configJson: leagues.configJson })
      .from(leagues)
      .where(eq(leagues.tournamentId, tournamentId))
      .limit(1);
    if (anyLeague) {
      const cfg = anyLeague.configJson as { scoring?: { topScorerPoints?: number; yellowCardsPoints?: number } } | null;
      pointsAwarded = type === "top_scorer"
        ? (cfg?.scoring?.topScorerPoints ?? 5)
        : (cfg?.scoring?.yellowCardsPoints ?? 5);
    }
  }

  // Upsert the bonus result
  await db
    .insert(tournamentBonusResults)
    .values({
      tournamentId,
      type,
      playerName: type === "top_scorer" ? playerName!.trim() : null,
      teamId: type === "most_yellow_cards" ? teamId! : null,
      pointsAwarded,
    })
    .onConflictDoUpdate({
      target: [tournamentBonusResults.tournamentId, tournamentBonusResults.type],
      set: {
        playerName: type === "top_scorer" ? playerName!.trim() : null,
        teamId: type === "most_yellow_cards" ? teamId! : null,
        pointsAwarded,
        confirmedAt: new Date(),
      },
    });

  // Find all predictions for this type across all leagues for the tournament
  const allPreds = await db
    .select()
    .from(bonusPredictions)
    .where(and(eq(bonusPredictions.tournamentId, tournamentId), eq(bonusPredictions.type, type)));

  if (allPreds.length === 0) {
    return Response.json({ ok: true, pointsAwarded: 0, correct: 0 });
  }

  let correctCount = 0;
  const predNotifs: { userId: string; leagueId: string; pts: number }[] = [];

  for (const pred of allPreds) {
    if (!pred.leagueId) continue;

    const isCorrect =
      type === "top_scorer"
        ? pred.playerName?.toLowerCase().trim() === playerName!.toLowerCase().trim()
        : pred.teamId === teamId;

    if (!isCorrect) continue;
    correctCount++;
    predNotifs.push({ userId: pred.userId, leagueId: pred.leagueId, pts: pointsAwarded });

    // Award points to pointSnapshots (additive, like match result)
    await db
      .insert(pointSnapshots)
      .values({
        userId: pred.userId,
        leagueId: pred.leagueId,
        tournamentId,
        totalPoints: pointsAwarded,
        matchesPlayed: 0,
        exactScores: 0,
        correctWinners: 0,
      })
      .onConflictDoUpdate({
        target: [pointSnapshots.userId, pointSnapshots.leagueId],
        set: {
          totalPoints: sql`point_snapshots.total_points + ${pointsAwarded}`,
          computedAt: new Date(),
        },
      });
  }

  // Send notifications to correct predictors
  if (predNotifs.length > 0) {
    const teamRow = teamId
      ? await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1).then((r) => r[0] ?? null)
      : null;

    await db.insert(notifications).values(
      predNotifs.map((n) => ({
        userId: n.userId,
        type: "prediction_result" as const,
        payload: {
          leagueId: n.leagueId,
          bonusType: type,
          answer: type === "top_scorer" ? playerName!.trim() : (teamRow?.name ?? teamId),
          points: n.pts,
          isExact: true,
        },
      }))
    );
  }

  // Re-rank and sync Redis for all affected leagues
  const affectedLeagueIds = [...new Set(allPreds.map((p) => p.leagueId).filter((id): id is string => id !== null))];

  for (const leagueId of affectedLeagueIds) {
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

    for (let i = 0; i < sorted.length; i++) {
      await db
        .update(pointSnapshots)
        .set({ rankInLeague: i + 1 })
        .where(and(eq(pointSnapshots.userId, sorted[i].userId), eq(pointSnapshots.leagueId, leagueId)));
    }

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
      JSON.stringify({ type: "leaderboard_updated", leagueId, updatedAt: new Date().toISOString() })
    );
  }

  return Response.json({ ok: true, pointsAwarded, correct: correctCount });
}
