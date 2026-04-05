import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, matches, predictions, leagues, leagueMembers } from "@/lib/db/schema";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: { matchId: string; homeScorePred: number; awayScorePred: number; leagueId: string };
  try {
    body = await request.json();
  } catch {
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
    return new Response("Invalid input", { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return new Response("User not found", { status: 404 });

  // Verify league exists and user is a member
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return new Response("League not found", { status: 404 });

  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, user.id), eq(leagueMembers.isActive, true)))
    .limit(1);
  if (!membership) return new Response("Not a member of this league", { status: 403 });

  // Fetch match and enforce deadline
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return new Response("Match not found", { status: 404 });
  if (new Date() >= match.scheduledAt) {
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
