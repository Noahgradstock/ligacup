import { auth } from "@clerk/nextjs/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, leagueMembers, messages } from "@/lib/db/schema";
import { redis, keys } from "@/lib/redis";

export type ChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string; // ISO
};

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/leagues/[id]/messages">
) {
  const { id: leagueId } = await ctx.params;

  // Try Redis list first (newest messages cached)
  try {
    const raw = await redis.lrange(keys.messages(leagueId), 0, 99);
    if (raw.length > 0) {
      const parsed: ChatMessage[] = raw.map((r) => JSON.parse(r));
      // LPUSH stores newest first — reverse to get chronological order
      return Response.json(parsed.reverse());
    }
  } catch {
    // fall through to Postgres
  }

  // Fallback: Postgres
  const rows = await db
    .select({
      id: messages.id,
      userId: messages.userId,
      text: messages.text,
      createdAt: messages.createdAt,
      displayName: users.displayName,
      email: users.email,
    })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(and(eq(messages.leagueId, leagueId), eq(messages.isDeleted, false)))
    .orderBy(desc(messages.createdAt))
    .limit(100);

  const result: ChatMessage[] = rows.reverse().map((r) => ({
    id: r.id,
    userId: r.userId,
    displayName: r.displayName ?? r.email.split("@")[0],
    text: r.text,
    createdAt: r.createdAt.toISOString(),
  }));

  return Response.json(result);
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/leagues/[id]/messages">
) {
  const { id: leagueId } = await ctx.params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: { text: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length === 0 || text.length > 500) {
    return new Response("Message must be 1–500 characters", { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return new Response("User not found", { status: 404 });

  // Verify membership
  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, user.id), eq(leagueMembers.isActive, true)))
    .limit(1);
  if (!membership) return new Response("Not a member", { status: 403 });

  // Persist to Postgres
  const [msg] = await db
    .insert(messages)
    .values({ leagueId, userId: user.id, text })
    .returning();

  const chatMsg: ChatMessage = {
    id: msg.id,
    userId: user.id,
    displayName: user.displayName ?? user.email.split("@")[0],
    text,
    createdAt: msg.createdAt.toISOString(),
  };

  // Push to Redis list (newest first), cap at 200
  await redis.lpush(keys.messages(leagueId), JSON.stringify(chatMsg));
  await redis.ltrim(keys.messages(leagueId), 0, 199);
  await redis.expire(keys.messages(leagueId), 60 * 60 * 24 * 30); // 30 days

  // Publish SSE event
  await redis.publish(
    keys.eventsChannel(leagueId),
    JSON.stringify({ type: "new_message", message: chatMsg })
  );

  return Response.json(chatMsg, { status: 201 });
}
