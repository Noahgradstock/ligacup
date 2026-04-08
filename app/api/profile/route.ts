import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { redis } from "@/lib/redis";

const RATE_LIMIT_SECONDS = 60 * 60; // 1 hour

export async function POST(request: Request) {
  const dbUser = await syncCurrentUser();
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const rateLimitKey = `profile:name-change:${dbUser.id}`;
  const lastChange = await redis.get(rateLimitKey);
  if (lastChange) {
    const secondsLeft = await redis.ttl(rateLimitKey);
    const minutesLeft = Math.ceil(secondsLeft / 60);
    return new Response(
      `Du kan bara ändra namn en gång per timme. Försök igen om ${minutesLeft} minut${minutesLeft === 1 ? "" : "er"}.`,
      { status: 429 }
    );
  }

  let body: { displayName: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const displayName = body.displayName?.trim();
  if (!displayName || displayName.length < 1 || displayName.length > 40) {
    return new Response("Name must be 1–40 characters", { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, dbUser.id))
    .returning();

  await redis.set(rateLimitKey, "1", "EX", RATE_LIMIT_SECONDS);

  return Response.json({ displayName: updated.displayName });
}
