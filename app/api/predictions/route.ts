import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, matches, predictions, leagues, leagueMembers } from "@/lib/db/schema";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    console.error("[predictions] 401 Unauthorized — no Clerk session");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { matchId: string; homeScorePred: number; awayScorePred: number; leagueId: string };
  try {
    body = await request.json();
  } catch {
    console.error("[predictions] 400 Invalid JSON");
    return new Response("Invalid JSON", { status: 400 });
  }

  const { matchId, homeScorePred, awayScorePred, leagueId } = body;
  if (
    typeof matchId !== "string" ||
    typeof leagueId !== "string" ||
    typeof homeScorePred !== "number" ||
    typeof awayScorePred !== "number" ||
    homeScorePred < 0 ||
    awayScorePred < 0 ||
    !Number.isInteger(homeScorePred) ||
    !Number.isInteger(awayScorePred)
  ) {
    console.error("[predictions] 400 Invalid input", { matchId, leagueId, homeScorePred, awayScorePred });
    return new Response("Invalid input", { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) {
    console.error("[predictions] 404 User not found for clerkId:", clerkId);
    return new Response("User not found", { status: 404 });
  }

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) {
    console.error("[predictions] 404 League not found:", leagueId);
    return new Response("League not found", { status: 404 });
  }

  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, user.id), eq(leagueMembers.isActive, true)))
    .limit(1);
  if (!membership) {
    console.error("[predictions] 403 Not a member — userId:", user.id, "leagueId:", leagueId);
    return new Response("Not a member of this league", { status: 403 });
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) {
    console.error("[predictions] 404 Match not found:", matchId);
    return new Response("Match not found", { status: 404 });
  }
  if (new Date() >= match.scheduledAt) {
    console.error("[predictions] 403 Deadline passed for match:", matchId, "scheduledAt:", match.scheduledAt);
    return new Response("Prediction deadline has passed", { status: 403 });
  }

  await db
    .insert(predictions)
    .values({ userId: user.id, matchId, leagueId, homeScorePred, awayScorePred })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId, predictions.leagueId],
      set: { homeScorePred, awayScorePred, updatedAt: new Date() },
    });

  return Response.json({ ok: true });
}
