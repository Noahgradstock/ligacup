import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pointSnapshots, users } from "@/lib/db/schema";
import { redis, keys } from "@/lib/redis";

export type LeaderboardEntry = {
  userId: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  totalPoints: number;
  rank: number;
};

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/leagues/[id]/leaderboard">
) {
  const { id: leagueId } = await ctx.params;

  // Try Redis sorted set first
  try {
    const key = keys.leaderboard(leagueId);
    const raw = await redis.zrevrange(key, 0, -1, "WITHSCORES");

    if (raw.length > 0) {
      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        const member = JSON.parse(raw[i]);
        entries.push({ ...member, totalPoints: parseInt(raw[i + 1], 10), rank: entries.length + 1 });
      }

      // Overlay fresh displayName/avatarUrl from Postgres — Redis JSON can be stale
      const userIds = entries.map((e) => e.userId);
      if (userIds.length > 0) {
        const freshUsers = await db
          .select({ id: users.id, displayName: users.displayName, email: users.email, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.id, userIds));
        const userMap = new Map(freshUsers.map((u) => [u.id, u]));
        for (const entry of entries) {
          const fresh = userMap.get(entry.userId);
          if (fresh) {
            entry.displayName = fresh.displayName;
            entry.email = fresh.email;
            entry.avatarUrl = fresh.avatarUrl ?? null;
          }
        }
      }

      return Response.json(entries);
    }
  } catch {
    // Redis unavailable — fall through to Postgres
  }

  // Fallback: Postgres
  const rows = await db
    .select({
      userId: pointSnapshots.userId,
      totalPoints: pointSnapshots.totalPoints,
      rankInLeague: pointSnapshots.rankInLeague,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(pointSnapshots)
    .innerJoin(users, eq(pointSnapshots.userId, users.id))
    .where(eq(pointSnapshots.leagueId, leagueId))
    .orderBy(pointSnapshots.totalPoints);

  const sorted = [...rows].sort((a, b) => b.totalPoints - a.totalPoints);
  const entries: LeaderboardEntry[] = sorted.map((r, i) => ({
    userId: r.userId,
    displayName: r.displayName,
    email: r.email,
    avatarUrl: r.avatarUrl ?? null,
    totalPoints: r.totalPoints,
    rank: i + 1,
  }));

  return Response.json(entries);
}
