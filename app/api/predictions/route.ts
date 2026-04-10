import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, matches, predictions, leagues, leagueMembers, tournamentRounds } from "@/lib/db/schema";
import { predWinnerIsHome } from "@/lib/predictor/winner";

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

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    console.error("[predictions] 401 Unauthorized — no Clerk session");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    matchId: string;
    homeScorePred: number;
    awayScorePred: number;
    leagueId: string;
    homeExtraTimePred?: number | null;
    awayExtraTimePred?: number | null;
    homePenaltyPred?: number | null;
    awayPenaltyPred?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    console.error("[predictions] 400 Invalid JSON");
    return new Response("Invalid JSON", { status: 400 });
  }

  const {
    matchId,
    homeScorePred,
    awayScorePred,
    leagueId,
    homeExtraTimePred = null,
    awayExtraTimePred = null,
    homePenaltyPred = null,
    awayPenaltyPred = null,
  } = body;

  if (
    typeof matchId !== "string" ||
    typeof leagueId !== "string" ||
    !isNonNegInt(homeScorePred) ||
    !isNonNegInt(awayScorePred)
  ) {
    console.error("[predictions] 400 Invalid input", { matchId, leagueId, homeScorePred, awayScorePred });
    return new Response("Invalid input", { status: 400 });
  }

  // Validate ET fields when provided
  if (homeExtraTimePred !== null || awayExtraTimePred !== null) {
    if (!isNonNegInt(homeExtraTimePred) || !isNonNegInt(awayExtraTimePred)) {
      return new Response("Invalid extra time scores", { status: 400 });
    }
  }

  // Validate penalty fields when provided
  if (homePenaltyPred !== null || awayPenaltyPred !== null) {
    if (!isNonNegInt(homePenaltyPred) || !isNonNegInt(awayPenaltyPred)) {
      return new Response("Invalid penalty scores", { status: 400 });
    }
    if (homePenaltyPred === awayPenaltyPred) {
      return new Response("Penalty shootout cannot end in a draw", { status: 400 });
    }
    // Penalties require ET to also be present
    if (homeExtraTimePred === null || awayExtraTimePred === null) {
      return new Response("Penalty scores require extra time scores", { status: 400 });
    }
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

  const oldWinnerIsHome = oldPred ? predWinnerIsHome({
    home: oldPred.homeScorePred,
    away: oldPred.awayScorePred,
    homeET: oldPred.homeExtraTimePred,
    awayET: oldPred.awayExtraTimePred,
    homePen: oldPred.homePenaltyPred,
    awayPen: oldPred.awayPenaltyPred,
  }) : null;

  const newWinnerIsHome = predWinnerIsHome({
    home: homeScorePred,
    away: awayScorePred,
    homeET: homeExtraTimePred,
    awayET: awayExtraTimePred,
    homePen: homePenaltyPred,
    awayPen: awayPenaltyPred,
  });

  // Cascade if: old had a definitive winner AND that winner differs from new
  // (newWinnerIsHome === null counts as "different" — we no longer know who advances)
  const winnerChanged = oldWinnerIsHome !== null && oldWinnerIsHome !== newWinnerIsHome;

  try {
    await db
      .insert(predictions)
      .values({
        userId: user.id,
        matchId,
        leagueId,
        homeScorePred,
        awayScorePred,
        homeExtraTimePred,
        awayExtraTimePred,
        homePenaltyPred,
        awayPenaltyPred,
      })
      .onConflictDoUpdate({
        target: [predictions.userId, predictions.matchId, predictions.leagueId],
        set: {
          homeScorePred,
          awayScorePred,
          homeExtraTimePred,
          awayExtraTimePred,
          homePenaltyPred,
          awayPenaltyPred,
          updatedAt: new Date(),
        },
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
