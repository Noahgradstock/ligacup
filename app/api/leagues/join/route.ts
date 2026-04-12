import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, leagues, leagueMembers, notifications } from "@/lib/db/schema";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: { code: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code || code.length !== 8) {
    return new Response("Invalid invite code", { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return new Response("User not found", { status: 404 });

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.inviteCode, code))
    .limit(1);
  if (!league) return new Response("League not found", { status: 404 });
  if (league.status !== "active") return new Response("League is not active", { status: 400 });

  // Check member count
  const memberCount = await db
    .select({ id: leagueMembers.id })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, league.id), eq(leagueMembers.isActive, true)));
  if (memberCount.length >= league.maxMembers) {
    return new Response("League is full", { status: 400 });
  }

  // Already a member?
  const existing = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, league.id), eq(leagueMembers.userId, user.id)))
    .limit(1);
  if (existing.length > 0) {
    return Response.json({ id: league.id, alreadyMember: true });
  }

  await db.insert(leagueMembers).values({ leagueId: league.id, userId: user.id });

  // Notify league owner (unless they're joining their own league)
  if (league.ownerId !== user.id) {
    await db.insert(notifications).values({
      userId: league.ownerId,
      type: "member_joined",
      payload: {
        leagueId: league.id,
        leagueName: league.name,
        joinerName: user.displayName ?? user.email.split("@")[0],
      },
    });
  }

  return Response.json({ id: league.id }, { status: 201 });
}
