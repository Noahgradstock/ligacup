import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, matches, predictions } from "@/lib/db/schema";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: { matchId: string; homeScorePred: number; awayScorePred: number };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { matchId, homeScorePred, awayScorePred } = body;
  if (
    typeof matchId !== "string" ||
    typeof homeScorePred !== "number" ||
    typeof awayScorePred !== "number" ||
    homeScorePred < 0 ||
    awayScorePred < 0 ||
    !Number.isInteger(homeScorePred) ||
    !Number.isInteger(awayScorePred)
  ) {
    return new Response("Invalid input", { status: 400 });
  }

  // Resolve user
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return new Response("User not found", { status: 404 });

  // Fetch match and enforce deadline
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return new Response("Match not found", { status: 404 });
  if (new Date() >= match.scheduledAt) {
    return new Response("Prediction deadline has passed", { status: 403 });
  }

  await db
    .insert(predictions)
    .values({
      userId: user.id,
      matchId,
      homeScorePred,
      awayScorePred,
    })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId],
      set: {
        homeScorePred,
        awayScorePred,
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}
