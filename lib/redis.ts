import Redis from "ioredis";

// Singleton for regular commands (get, set, zadd, zrevrange, etc.)
const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// Pub/Sub clients must be dedicated — cannot share with regular commands.
// Create a fresh subscriber per SSE connection (called in the route).
export function createSubscriber(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

// Redis key helpers
export const keys = {
  leaderboard: (leagueId: string) => `league:${leagueId}:leaderboard`,
  leaderboardChannel: (leagueId: string) => `league:${leagueId}:leaderboard_updated`,
};
