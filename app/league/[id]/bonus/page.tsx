import { eq, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  users,
  bonusPredictions,
  tournamentBonusResults,
  teams,
} from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { BonusView } from "@/components/bonus-view";

function toFlag(code: string | null | undefined) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default async function BonusPage({
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
    scoring?: { topScorerPoints?: number; yellowCardsPoints?: number };
  } | null;
  const features = config?.features ?? [];
  const hasTopScorer = features.includes("top_scorer");
  const hasYellowCards = features.includes("most_yellow_cards");

  if (!hasTopScorer && !hasYellowCards) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-16 text-center">
        <p className="text-muted-foreground text-sm">Inga bonustips är aktiverade i det här tiplaget.</p>
      </div>
    );
  }

  const topScorerPoints = config?.scoring?.topScorerPoints ?? 5;
  const yellowCardsPoints = config?.scoring?.yellowCardsPoints ?? 5;

  // League members
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

  // All bonus predictions for this league
  const preds = await db
    .select()
    .from(bonusPredictions)
    .where(eq(bonusPredictions.leagueId, id));

  // Teams for yellow cards picker + resolve team names in predictions
  const allTeams = hasYellowCards
    ? await db
        .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
        .from(teams)
        .orderBy(teams.name)
    : [];

  const teamIds = [...new Set(preds.map((p) => p.teamId).filter((t): t is string => t !== null))];
  const predTeams =
    teamIds.length > 0
      ? await db
          .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : [];
  const teamMap = new Map(predTeams.map((t) => [t.id, t]));

  // Confirmed bonus results
  const bonusResults = await db
    .select()
    .from(tournamentBonusResults)
    .where(eq(tournamentBonusResults.tournamentId, league.tournamentId));

  const resultTeamIds = bonusResults.map((r) => r.teamId).filter((t): t is string => t !== null);
  const resultTeams =
    resultTeamIds.length > 0
      ? await db
          .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
          .from(teams)
          .where(inArray(teams.id, resultTeamIds))
      : [];
  const resultTeamMap = new Map(resultTeams.map((t) => [t.id, t]));

  const confirmedResults = Object.fromEntries(
    bonusResults.map((r) => {
      const team = r.teamId ? resultTeamMap.get(r.teamId) : null;
      return [
        r.type,
        {
          playerName: r.playerName ?? null,
          teamId: r.teamId ?? null,
          teamName: team?.name ?? null,
          teamFlag: toFlag(team?.countryCode),
          pointsAwarded: r.pointsAwarded,
        },
      ];
    })
  );

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bonustips</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tippa vem som tar skyttekungstiteln och vilket lag som får flest gula kort.
        </p>
      </div>

      <BonusView
        leagueId={id}
        currentUserId={dbUser?.id ?? null}
        features={features}
        topScorerPoints={topScorerPoints}
        yellowCardsPoints={yellowCardsPoints}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          email: m.email,
          avatarUrl: m.avatarUrl ?? null,
        }))}
        predictions={preds.map((p) => ({
          userId: p.userId,
          type: p.type,
          playerName: p.playerName ?? null,
          teamId: p.teamId ?? null,
          teamName: p.teamId ? (teamMap.get(p.teamId)?.name ?? null) : null,
          teamFlag: p.teamId ? toFlag(teamMap.get(p.teamId)?.countryCode) : "🏳",
        }))}
        allTeams={allTeams.map((t) => ({
          id: t.id,
          name: t.name,
          flag: toFlag(t.countryCode),
        }))}
        confirmedResults={confirmedResults}
      />
    </div>
  );
}
