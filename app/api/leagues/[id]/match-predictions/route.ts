import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  matches,
  predictions,
  leagueMembers,
  users,
} from "@/lib/db/schema";
import { calcPoints } from "@/lib/predictor/points";

const DEFAULT_RULES = { pointsExactScore: 3, pointsCorrectWinner: 1, pointsCorrectDraw: 1 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const { id: leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");
  if (!matchId) return new Response("matchId required", { status: 400 });

  // Verify requesting user is a league member
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!dbUser) return new Response("User not found", { status: 404 });

  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(
      and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.userId, dbUser.id),
        eq(leagueMembers.isActive, true)
      )
    )
    .limit(1);
  if (!membership) return new Response("Not a member", { status: 403 });

  // Match must be locked (past scheduledAt)
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return new Response("Match not found", { status: 404 });
  if (new Date() < match.scheduledAt) {
    return new Response("Match not started yet", { status: 403 });
  }

  // Fetch all predictions for this match+league, joined with user display names
  const rows = await db
    .select({
      userId: predictions.userId,
      homeScorePred: predictions.homeScorePred,
      awayScorePred: predictions.awayScorePred,
      displayName: users.displayName,
      email: users.email,
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(
      and(
        eq(predictions.matchId, matchId),
        eq(predictions.leagueId, leagueId)
      )
    );

  const hasResult =
    match.isResultConfirmed &&
    match.homeScore !== null &&
    match.awayScore !== null;

  const result = rows.map((r) => {
    const pointsEarned =
      hasResult
        ? calcPoints(
            { home: r.homeScorePred, away: r.awayScorePred },
            { home: match.homeScore!, away: match.awayScore! },
            DEFAULT_RULES
          )
        : null;
    return {
      displayName: r.displayName ?? r.email.split("@")[0],
      homeScorePred: r.homeScorePred,
      awayScorePred: r.awayScorePred,
      pointsEarned,
      isCurrentUser: r.userId === dbUser.id,
    };
  });

  // Sort: current user first, then by points desc, then by name
  result.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    if (a.pointsEarned !== null && b.pointsEarned !== null) {
      return b.pointsEarned - a.pointsEarned;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return Response.json({ predictions: result });
}
