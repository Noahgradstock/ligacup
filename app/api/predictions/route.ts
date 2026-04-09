import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, matches, predictions, leagues, leagueMembers, tournamentRounds } from "@/lib/db/schema";

const NEXT_ROUND: Record<string, { nextType: string; prefix: string } | undefined> = {
  ROUND_OF_32: { nextType: "ROUND_OF_16", prefix: "VM" },
  ROUND_OF_16: { nextType: "QF", prefix: "VM" },
  QF: { nextType: "SF", prefix: "VK" },
  SF: { nextType: "FINAL", prefix: "VS" },
};

// Recursively find ALL downstream match IDs that depend (directly or indirectly)
// on this match's winner — e.g. if R32 winner changes, clear R16 + QF + SF + Final.
async function getAllDownstreamMatchIds(
  matchNumber: number,
  roundType: string,
  tournamentId: string
): Promise<{ id: string; matchNumber: number; roundType: string }[]> {
  const step = NEXT_ROUND[roundType];
  if (!step) return [];

  const slotKey = `${step.prefix}${matchNumber}`;

  const nextMatches = await db
    .select({ id: matches.id, venue: matches.venue, matchNumber: matches.matchNumber })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        eq(tournamentRounds.roundType, step.nextType)
      )
    );

  const hit = nextMatches.find((m) => {
    if (!m.venue) return false;
    try {
      const v = JSON.parse(m.venue);
      return v.homeSlot === slotKey || v.awaySlot === slotKey;
    } catch {
      return false;
    }
  });

  if (!hit || hit.matchNumber === null) return [];

  const deeper = await getAllDownstreamMatchIds(hit.matchNumber, step.nextType, tournamentId);
  return [{ id: hit.id, matchNumber: hit.matchNumber, roundType: step.nextType }, ...deeper];
}

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

  const [matchWithRound] = await db
    .select({ match: matches, roundType: tournamentRounds.roundType })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!matchWithRound) {
    console.error("[predictions] 404 Match not found:", matchId);
    return new Response("Match not found", { status: 404 });
  }
  if (new Date() >= matchWithRound.match.scheduledAt) {
    console.error("[predictions] 403 Deadline passed for match:", matchId, "scheduledAt:", matchWithRound.match.scheduledAt);
    return new Response("Prediction deadline has passed", { status: 403 });
  }

  // Check existing prediction to detect winner change
  const [oldPred] = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, user.id),
        eq(predictions.matchId, matchId),
        eq(predictions.leagueId, leagueId)
      )
    )
    .limit(1);

  const oldWinnerIsHome = oldPred ? oldPred.homeScorePred >= oldPred.awayScorePred : null;
  const newWinnerIsHome = homeScorePred >= awayScorePred;
  const winnerChanged = oldWinnerIsHome !== null && oldWinnerIsHome !== newWinnerIsHome;

  try {
    await db
      .insert(predictions)
      .values({ userId: user.id, matchId, leagueId, homeScorePred, awayScorePred })
      .onConflictDoUpdate({
        target: [predictions.userId, predictions.matchId, predictions.leagueId],
        set: { homeScorePred, awayScorePred, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("[predictions] 500 DB error:", err);
    return new Response("Internal server error", { status: 500 });
  }

  // Cascade: clear ALL downstream predictions that are invalidated by the winner change.
  // E.g. changing an R32 winner clears R16 + QF + SF + Final predictions in one go.
  let invalidatedMatchIds: string[] = [];
  if (winnerChanged && matchWithRound.match.matchNumber !== null) {
    try {
      const downstream = await getAllDownstreamMatchIds(
        matchWithRound.match.matchNumber,
        matchWithRound.roundType,
        matchWithRound.match.tournamentId
      );
      if (downstream.length > 0) {
        invalidatedMatchIds = downstream.map((m) => m.id);
        await db.delete(predictions).where(
          and(
            eq(predictions.userId, user.id),
            eq(predictions.leagueId, leagueId),
            inArray(predictions.matchId, invalidatedMatchIds)
          )
        );
      }
    } catch (err) {
      console.error("[predictions] cascade clear error (non-fatal):", err);
    }
  }

  return Response.json({ ok: true, invalidatedMatchIds });
}
