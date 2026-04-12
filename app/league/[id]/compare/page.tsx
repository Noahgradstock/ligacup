export const dynamic = "force-dynamic";

import { eq, and, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  users,
  tournamentTop3Predictions,
  bonusPredictions,
  teams,
} from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { CompareView } from "@/components/compare-view";

function toFlag(code: string | null | undefined) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [dbUser, league] = await Promise.all([
    syncCurrentUser(),
    db.select().from(leagues).where(eq(leagues.id, id)).limit(1).then((r) => r[0] ?? null),
  ]);

  if (!league) notFound();

  if (dbUser) {
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, id),
          eq(leagueMembers.userId, dbUser.id),
          eq(leagueMembers.isActive, true)
        )
      )
      .limit(1);
    if (!membership) notFound();
  }

  const config = league.configJson as {
    features?: string[];
  } | null;
  const features = config?.features ?? [];
  const hasTopScorer = features.includes("top_scorer");
  const hasYellowCards = features.includes("most_yellow_cards");

  // All active league members
  const members = await db
    .select({
      userId: leagueMembers.userId,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(leagueMembers)
    .innerJoin(users, eq(leagueMembers.userId, users.id))
    .where(and(eq(leagueMembers.leagueId, id), eq(leagueMembers.isActive, true)));

  // Top 3 predictions — join all three team aliases
  const t1 = alias(teams, "t1");
  const t2 = alias(teams, "t2");
  const t3 = alias(teams, "t3");

  const top3Rows = await db
    .select({
      userId: tournamentTop3Predictions.userId,
      firstTeamName: t1.name,
      firstTeamCode: t1.countryCode,
      secondTeamName: t2.name,
      secondTeamCode: t2.countryCode,
      thirdTeamName: t3.name,
      thirdTeamCode: t3.countryCode,
    })
    .from(tournamentTop3Predictions)
    .leftJoin(t1, eq(tournamentTop3Predictions.firstTeamId, t1.id))
    .leftJoin(t2, eq(tournamentTop3Predictions.secondTeamId, t2.id))
    .leftJoin(t3, eq(tournamentTop3Predictions.thirdTeamId, t3.id))
    .where(eq(tournamentTop3Predictions.leagueId, id));

  const top3 = top3Rows.map((r) => ({
    userId: r.userId,
    first: r.firstTeamName ? { name: r.firstTeamName, flag: toFlag(r.firstTeamCode) } : null,
    second: r.secondTeamName ? { name: r.secondTeamName, flag: toFlag(r.secondTeamCode) } : null,
    third: r.thirdTeamName ? { name: r.thirdTeamName, flag: toFlag(r.thirdTeamCode) } : null,
  }));

  // Bonus predictions
  const bonusRows = (hasTopScorer || hasYellowCards)
    ? await db
        .select()
        .from(bonusPredictions)
        .where(eq(bonusPredictions.leagueId, id))
    : [];

  // Resolve team names for yellow cards bonus predictions
  const teamIds = [...new Set(bonusRows.map((p) => p.teamId).filter((t): t is string => t !== null))];
  const predTeams = teamIds.length > 0
    ? await db
        .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
        .from(teams)
        .where(inArray(teams.id, teamIds))
    : [];
  const teamMap = new Map(predTeams.map((t) => [t.id, t]));

  const bonus = bonusRows.map((p) => {
    const team = p.teamId ? teamMap.get(p.teamId) : null;
    return {
      userId: p.userId,
      type: p.type,
      value: p.type === "top_scorer" ? (p.playerName ?? "") : (team?.name ?? ""),
      flag: p.type === "most_yellow_cards" ? toFlag(team?.countryCode) : undefined,
    };
  });

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jämför tips</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Se hur deltagarnas VM-tips skiljer sig åt.
        </p>
      </div>
      <CompareView
        currentUserId={dbUser?.id ?? null}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          email: m.email,
          avatarUrl: m.avatarUrl ?? null,
        }))}
        top3={top3}
        bonus={bonus}
        hasTopScorer={hasTopScorer}
        hasYellowCards={hasYellowCards}
      />
    </div>
  );
}
