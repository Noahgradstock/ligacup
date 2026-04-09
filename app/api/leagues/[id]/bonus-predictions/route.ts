import { auth } from "@clerk/nextjs/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  leagues,
  leagueMembers,
  bonusPredictions,
  tournamentBonusResults,
  teams,
} from "@/lib/db/schema";

const VALID_TYPES = ["top_scorer", "most_yellow_cards"] as const;
type BonusType = (typeof VALID_TYPES)[number];

// RouteContext helper (matches pattern used elsewhere in codebase)
type RouteContext<P extends string> = { params: Promise<Record<string, string>> & { [K in P extends `/[${infer K}]` ? K : never]: string } };

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/leagues/[id]/bonus-predictions">
) {
  const params = await ctx.params;
  const leagueId = params.id;

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return new Response("League not found", { status: 404 });

  const config = league.configJson as { features?: string[]; scoring?: Record<string, number> } | null;
  const features = config?.features ?? [];
  const scoring = config?.scoring ?? {};

  // Fetch all bonus predictions for the league
  const preds = await db
    .select({
      userId: bonusPredictions.userId,
      type: bonusPredictions.type,
      playerName: bonusPredictions.playerName,
      teamId: bonusPredictions.teamId,
      updatedAt: bonusPredictions.updatedAt,
    })
    .from(bonusPredictions)
    .where(eq(bonusPredictions.leagueId, leagueId));

  // Resolve team names for yellow card predictions
  const teamIds = [...new Set(preds.map((p) => p.teamId).filter((id): id is string => id !== null))];
  const teamRows =
    teamIds.length > 0
      ? await db
          .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : [];
  const teamMap = new Map(teamRows.map((t) => [t.id, t]));

  // Fetch confirmed bonus results
  const results = await db
    .select({
      type: tournamentBonusResults.type,
      playerName: tournamentBonusResults.playerName,
      teamId: tournamentBonusResults.teamId,
      pointsAwarded: tournamentBonusResults.pointsAwarded,
    })
    .from(tournamentBonusResults)
    .where(eq(tournamentBonusResults.tournamentId, league.tournamentId));

  const resultMap = new Map(results.map((r) => [r.type, r]));

  return Response.json({
    features,
    scoring,
    predictions: preds.map((p) => ({
      userId: p.userId,
      type: p.type,
      playerName: p.playerName ?? null,
      teamId: p.teamId ?? null,
      teamName: p.teamId ? (teamMap.get(p.teamId)?.name ?? null) : null,
      teamCode: p.teamId ? (teamMap.get(p.teamId)?.countryCode ?? null) : null,
      updatedAt: p.updatedAt.toISOString(),
    })),
    results: Object.fromEntries(
      results.map((r) => [
        r.type,
        {
          playerName: r.playerName ?? null,
          teamId: r.teamId ?? null,
          teamName: r.teamId ? (teamMap.get(r.teamId)?.name ?? null) : null,
          teamCode: r.teamId ? (teamMap.get(r.teamId)?.countryCode ?? null) : null,
          pointsAwarded: r.pointsAwarded,
        },
      ])
    ),
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/leagues/[id]/bonus-predictions">
) {
  const params = await ctx.params;
  const leagueId = params.id;

  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: { type: string; playerName?: string; teamId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { type, playerName, teamId } = body;
  if (!VALID_TYPES.includes(type as BonusType)) {
    return new Response("Invalid type", { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return new Response("User not found", { status: 404 });

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return new Response("League not found", { status: 404 });

  // Check feature is enabled
  const config = league.configJson as { features?: string[] } | null;
  const features = config?.features ?? [];
  if (!features.includes(type)) {
    return new Response("Feature not enabled in this league", { status: 403 });
  }

  // Check membership
  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(
      and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.userId, user.id),
        eq(leagueMembers.isActive, true)
      )
    )
    .limit(1);
  if (!membership) return new Response("Not a member of this league", { status: 403 });

  // Validate payload per type
  if (type === "top_scorer") {
    const name = playerName?.trim();
    if (!name || name.length < 2 || name.length > 100) {
      return new Response("Player name must be 2–100 characters", { status: 400 });
    }
    await db
      .insert(bonusPredictions)
      .values({
        userId: user.id,
        leagueId,
        tournamentId: league.tournamentId,
        type,
        playerName: name,
        teamId: null,
      })
      .onConflictDoUpdate({
        target: [bonusPredictions.userId, bonusPredictions.leagueId, bonusPredictions.type],
        set: { playerName: name, teamId: null, updatedAt: new Date() },
      });
  } else {
    // most_yellow_cards
    if (!teamId || typeof teamId !== "string") {
      return new Response("teamId required for most_yellow_cards", { status: 400 });
    }
    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return new Response("Team not found", { status: 404 });

    await db
      .insert(bonusPredictions)
      .values({
        userId: user.id,
        leagueId,
        tournamentId: league.tournamentId,
        type,
        playerName: null,
        teamId,
      })
      .onConflictDoUpdate({
        target: [bonusPredictions.userId, bonusPredictions.leagueId, bonusPredictions.type],
        set: { teamId, playerName: null, updatedAt: new Date() },
      });
  }

  return Response.json({ ok: true });
}
