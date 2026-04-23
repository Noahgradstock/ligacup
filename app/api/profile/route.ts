import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { redis } from "@/lib/redis";
import type { Locale } from "@/lib/i18n";

const RATE_LIMIT_SECONDS = 60 * 60; // 1 hour

export async function POST(request: Request) {
  const dbUser = await syncCurrentUser();
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  let body: { displayName?: string; locale?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Locale-only update (no rate limit) ──────────────────────────────────
  if (body.locale !== undefined && body.displayName === undefined) {
    const locale = body.locale === "en" ? "en" : "sv";
    await db.update(users).set({ locale }).where(eq(users.id, dbUser.id));
    return new Response(JSON.stringify({ locale }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `ligacup_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
    });
  }

  // ── Display name update (rate-limited) ──────────────────────────────────
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

// Helper to read locale from DB for server components that need it
export async function getDbLocale(userId: string): Promise<Locale> {
  const [row] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (row?.locale ?? "sv") as Locale;
}
