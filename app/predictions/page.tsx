import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { matches, teams, tournamentRounds, tournaments, predictions } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { PredictionsView } from "@/components/predictions-view";
import { syncCurrentUser } from "@/lib/sync-user";

function toFlag(code: string | null) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default async function PredictionsPage() {
  const dbUser = await syncCurrentUser();

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  const rows = await db
    .select({
      match: matches,
      round: tournamentRounds,
      homeTeam: { name: homeTeam.name, countryCode: homeTeam.countryCode },
      awayTeam: { name: awayTeam.name, countryCode: awayTeam.countryCode },
    })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(eq(tournaments.slug, "vm-2026"))
    .orderBy(matches.scheduledAt);

  const predMap = new Map<string, { home: number; away: number }>();
  if (dbUser && rows.length > 0) {
    const matchIds = rows.map((r) => r.match.id);
    const preds = await db
      .select()
      .from(predictions)
      .where(inArray(predictions.matchId, matchIds))
      .then((p) => p.filter((x) => x.userId === dbUser.id));
    for (const p of preds) {
      predMap.set(p.matchId, { home: p.homeScorePred, away: p.awayScorePred });
    }
  }

  const now = new Date();

  // Extract sorted unique group names
  const groups = [...new Set(
    rows
      .map((r) => r.match.groupName ?? "")
      .filter(Boolean)
  )].sort();

  const matchData = rows.map(({ match, homeTeam: ht, awayTeam: at }) => {
    const pred = predMap.get(match.id) ?? null;
    return {
      matchId: match.id,
      homeTeam: ht.name,
      homeFlag: toFlag(ht.countryCode),
      awayTeam: at.name,
      awayFlag: toFlag(at.countryCode),
      scheduledAt: match.scheduledAt.toISOString(),
      groupName: match.groupName ?? "",
      existingHome: pred?.home ?? null,
      existingAway: pred?.away ?? null,
      isLocked: now >= match.scheduledAt,
    };
  });

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav />

      <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tippa matcherna</h1>
          <p className="text-muted-foreground text-sm mt-1">
            3p för exakt resultat · 1p för rätt vinnare/oavgjort
          </p>
        </div>

        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary">
          Dina tips gäller automatiskt i <strong>alla dina tipslag</strong>. Du behöver bara tippa en gång.
        </div>

        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Inga matcher hittades. Kör seed-scriptet på servern.
          </p>
        ) : (
          <PredictionsView matches={matchData} groups={groups} />
        )}
      </div>

      <BottomNav />
    </main>
  );
}
