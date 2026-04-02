import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { db } from "@/lib/db";
import { users, matches, teams, tournamentRounds, tournaments, predictions } from "@/lib/db/schema";
import { MatchCard } from "@/components/match-card";

function toFlag(code: string | null) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export default async function PredictionsPage() {
  const { userId: clerkId } = await auth();

  // Resolve internal user (may not exist yet if webhook hasn't fired)
  const dbUser = clerkId
    ? (await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1))[0] ?? null
    : null;

  // Fetch all group stage matches for vm-2026
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

  // Fetch existing predictions for this user
  const predMap = new Map<string, { home: number; away: number }>();
  if (dbUser && rows.length > 0) {
    const matchIds = rows.map((r) => r.match.id);
    const preds = await db
      .select()
      .from(predictions)
      .where(
        inArray(predictions.matchId, matchIds)
      )
      .then((p) => p.filter((x) => x.userId === dbUser.id));

    for (const p of preds) {
      predMap.set(p.matchId, { home: p.homeScorePred, away: p.awayScorePred });
    }
  }

  // Group matches by date (YYYY-MM-DD in local time)
  const now = new Date();
  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.match.scheduledAt.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(row);
  }

  return (
    <main className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
        </Link>
        <span className="text-sm text-muted-foreground">Mina tips</span>
      </nav>

      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tippa matcherna</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tips låses när matchen börjar. 3p för exakt resultat, 1p för rätt vinnare/oavgjort.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-muted-foreground">
            Inga matcher hittades. Kör <code>npm run db:seed</code> på servern.
          </p>
        ) : (
          Array.from(byDate.entries()).map(([dateKey, dayRows]) => {
            const label = new Date(dateKey).toLocaleDateString("sv-SE", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            return (
              <section key={dateKey} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </h2>
                {dayRows.map(({ match, homeTeam: ht, awayTeam: at }) => {
                  const pred = predMap.get(match.id) ?? null;
                  const isLocked = now >= match.scheduledAt;
                  return (
                    <MatchCard
                      key={match.id}
                      matchId={match.id}
                      homeTeam={ht.name}
                      homeFlag={toFlag(ht.countryCode)}
                      awayTeam={at.name}
                      awayFlag={toFlag(at.countryCode)}
                      scheduledAt={match.scheduledAt.toISOString()}
                      groupName={match.groupName ?? ""}
                      existingHome={pred?.home ?? null}
                      existingAway={pred?.away ?? null}
                      isLocked={isLocked}
                    />
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
