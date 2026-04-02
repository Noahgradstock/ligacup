import Redis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

// Singleton for app usage
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ?? new Redis(url, { maxRetriesPerRequest: null });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

// Separate pub/sub clients (cannot share connection with regular commands)
export function createRedisSubscriber() {
  return new Redis(url, { maxRetriesPerRequest: null });
}

// Key helpers — central place so typos don't cause silent bugs
export const keys = {
  leaderboard: (leagueId: string) => `leaderboard:${leagueId}`,
  chat: (leagueId: string) => `chat:${leagueId}`,
  chatChannel: (leagueId: string) => `chat:${leagueId}:ch`,
  eventsChannel: (leagueId: string) => `events:${leagueId}`,
  roast: (userId: string, bracketHash: string) => `roast:${userId}:${bracketHash}`,
  roastRateLimit: (userId: string) => `rate:${userId}:roast`,
  session: (userId: string) => `session:${userId}`,
};
