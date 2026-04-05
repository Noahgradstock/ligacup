import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { db } from "@/lib/db";
import { matches, teams, tournamentRounds, tournaments } from "@/lib/db/schema";
import { ResultForm } from "./result-form";

export default async function AdminMatchesPage() {
  const jar = await cookies();
  const authed = jar.get("admin_session")?.value === process.env.ADMIN_SECRET;
  if (!authed) redirect("/admin");

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  const rows = await db
    .select({
      match: matches,
      round: tournamentRounds,
      homeTeam: { name: homeTeam.name },
      awayTeam: { name: awayTeam.name },
    })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(eq(tournaments.slug, "vm-2026"))
    .orderBy(matches.scheduledAt);

  // Group by date
  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.match.scheduledAt.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(row);
  }

  const confirmed = rows.filter((r) => r.match.isResultConfirmed).length;

  return (
    <main className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">Admin</span>
        </Link>
        <span className="text-sm text-muted-foreground">
          {confirmed}/{rows.length} bekräftade
        </span>
      </nav>

      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-10">
        <h1 className="text-2xl font-bold tracking-tight">Matchresultat</h1>

        {rows.length === 0 ? (
          <p className="text-muted-foreground">Inga matcher. Kör db:seed på servern.</p>
        ) : (
          Array.from(byDate.entries()).map(([dateKey, dayRows]) => {
            const label = new Date(dateKey).toLocaleDateString("sv-SE", {
              weekday: "long", month: "long", day: "numeric",
            });
            return (
              <section key={dateKey} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {label}
                </h2>
                {dayRows.map(({ match, homeTeam: ht, awayTeam: at, round }) => (
                  <div
                    key={match.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 rounded-lg border bg-card ${
                      match.isResultConfirmed
                        ? "border-green-200 bg-green-50"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-semibold text-primary shrink-0">
                        {round.name}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {ht.name} – {at.name}
                      </span>
                    </div>
                    <div className="shrink-0">
                      {match.isResultConfirmed ? (
                        <span className="text-sm font-mono font-bold text-green-700">
                          {match.homeScore} – {match.awayScore} ✓
                        </span>
                      ) : (
                        <ResultForm matchId={match.id} />
                      )}
                    </div>
                  </div>
                ))}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
