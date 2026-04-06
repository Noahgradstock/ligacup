import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  teams,
  tournamentTop3Predictions,
} from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { alias } from "drizzle-orm/pg-core";

export type Top3Entry = {
  userId: string;
  firstTeamId: string | null;
  firstTeamName: string | null;
  firstTeamCode: string | null;
  secondTeamId: string | null;
  secondTeamName: string | null;
  secondTeamCode: string | null;
  thirdTeamId: string | null;
  thirdTeamName: string | null;
  thirdTeamCode: string | null;
};

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/leagues/[id]/top3">
) {
  const { id: leagueId } = await ctx.params;

  const t1 = alias(teams, "t1");
  const t2 = alias(teams, "t2");
  const t3 = alias(teams, "t3");

  const rows = await db
    .select({
      userId: tournamentTop3Predictions.userId,
      firstTeamId: tournamentTop3Predictions.firstTeamId,
      firstTeamName: t1.name,
      firstTeamCode: t1.countryCode,
      secondTeamId: tournamentTop3Predictions.secondTeamId,
      secondTeamName: t2.name,
      secondTeamCode: t2.countryCode,
      thirdTeamId: tournamentTop3Predictions.thirdTeamId,
      thirdTeamName: t3.name,
      thirdTeamCode: t3.countryCode,
    })
    .from(tournamentTop3Predictions)
    .leftJoin(t1, eq(tournamentTop3Predictions.firstTeamId, t1.id))
    .leftJoin(t2, eq(tournamentTop3Predictions.secondTeamId, t2.id))
    .leftJoin(t3, eq(tournamentTop3Predictions.thirdTeamId, t3.id))
    .where(eq(tournamentTop3Predictions.leagueId, leagueId));

  return Response.json(rows);
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/leagues/[id]/top3">
) {
  const { id: leagueId } = await ctx.params;

  const dbUser = await syncCurrentUser();
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  // Must be an active member
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
  if (!membership) return new Response("Forbidden", { status: 403 });

  let body: { firstTeamId: string | null; secondTeamId: string | null; thirdTeamId: string | null };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const [league] = await db
    .select({ tournamentId: leagues.tournamentId })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);
  if (!league) return new Response("Not found", { status: 404 });

  await db
    .insert(tournamentTop3Predictions)
    .values({
      userId: dbUser.id,
      leagueId,
      tournamentId: league.tournamentId,
      firstTeamId: body.firstTeamId ?? null,
      secondTeamId: body.secondTeamId ?? null,
      thirdTeamId: body.thirdTeamId ?? null,
    })
    .onConflictDoUpdate({
      target: [tournamentTop3Predictions.userId, tournamentTop3Predictions.leagueId],
      set: {
        firstTeamId: body.firstTeamId ?? null,
        secondTeamId: body.secondTeamId ?? null,
        thirdTeamId: body.thirdTeamId ?? null,
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}
