import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { db } from "@/lib/db";
import { matches, teams, tournamentRounds, tournaments } from "@/lib/db/schema";
import { ResultForm } from "./result-form";
import { TeamAssignForm } from "./team-assign-form";

function toFlag(code: string | null | undefined) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function parseSlots(venue: string | null): { homeSlot: string; awaySlot: string } {
  if (!venue) return { homeSlot: "?", awaySlot: "?" };
  try {
    const p = JSON.parse(venue);
    return { homeSlot: p.homeSlot ?? "?", awaySlot: p.awaySlot ?? "?" };
  } catch {
    return { homeSlot: "?", awaySlot: "?" };
  }
}

const ROUND_TYPE_ORDER = ["GROUP", "ROUND_OF_16", "QF", "SF", "FINAL"];

export default async function AdminMatchesPage() {
  const jar = await cookies();
  const authed = jar.get("admin_session")?.value === process.env.ADMIN_SECRET;
  if (!authed) redirect("/admin");

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  const [rows, allTeams] = await Promise.all([
    db
      .select({
        match: matches,
        round: tournamentRounds,
        homeTeamName: homeTeam.name,
        homeTeamCode: homeTeam.countryCode,
        awayTeamName: awayTeam.name,
        awayTeamCode: awayTeam.countryCode,
      })
      .from(matches)
      .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
      .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
      .leftJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .leftJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
      .where(eq(tournaments.slug, "vm-2026"))
      .orderBy(tournamentRounds.sequenceOrder, matches.scheduledAt),
    db.select().from(teams).orderBy(teams.name),
  ]);

  const teamOptions = allTeams.map((t) => ({
    id: t.id,
    name: t.name,
    flag: toFlag(t.countryCode),
  }));

  // Group by round type then by date within each round
  const roundOrder = ROUND_TYPE_ORDER;
  const byRound = new Map<string, typeof rows>();
  for (const row of rows) {
    const rt = row.round.roundType;
    if (!byRound.has(rt)) byRound.set(rt, []);
    byRound.get(rt)!.push(row);
  }

  const confirmed = rows.filter((r) => r.match.isResultConfirmed).length;
  const total = rows.length;

  return (
    <main className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">Admin</span>
        </Link>
        <span className="text-sm text-muted-foreground">
          {confirmed}/{total} bekräftade
        </span>
      </nav>

      <div className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-10">
        <h1 className="text-2xl font-bold tracking-tight">Matchresultat</h1>

        {rows.length === 0 ? (
          <p className="text-muted-foreground">Inga matcher. Kör db:seed på servern.</p>
        ) : (
          roundOrder.map((roundType) => {
            const roundRows = byRound.get(roundType);
            if (!roundRows || roundRows.length === 0) return null;

            const roundName = roundRows[0].round.name;

            // Group by date within the round
            const byDate = new Map<string, typeof roundRows>();
            for (const row of roundRows) {
              const key = row.match.scheduledAt.toISOString().slice(0, 10);
              if (!byDate.has(key)) byDate.set(key, []);
              byDate.get(key)!.push(row);
            }

            return (
              <section key={roundType} className="flex flex-col gap-4">
                <h2 className="text-base font-bold tracking-tight border-b border-border pb-2">
                  {roundName}
                </h2>

                {Array.from(byDate.entries()).map(([dateKey, dayRows]) => {
                  const label = new Date(dateKey + "T12:00:00").toLocaleDateString("sv-SE", {
                    weekday: "long", month: "long", day: "numeric",
                  });
                  return (
                    <div key={dateKey} className="flex flex-col gap-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {label}
                      </p>
                      {dayRows.map(({ match, round, homeTeamName, homeTeamCode, awayTeamName, awayTeamCode }) => {
                        const isTbd = homeTeamName === null || awayTeamName === null;
                        const { homeSlot, awaySlot } = parseSlots(match.venue);

                        return (
                          <div
                            key={match.id}
                            className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg border bg-card ${
                              match.isResultConfirmed
                                ? "border-green-200 bg-green-50"
                                : isTbd
                                ? "border-amber-200 bg-amber-50/40"
                                : "border-border"
                            }`}
                          >
                            {/* Match info */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-semibold text-primary shrink-0">
                                M{match.matchNumber}
                              </span>
                              {isTbd ? (
                                <span className="text-sm text-muted-foreground italic">
                                  {homeSlot} vs {awaySlot}
                                </span>
                              ) : (
                                <span className="text-sm font-medium truncate">
                                  {toFlag(homeTeamCode)} {homeTeamName} – {toFlag(awayTeamCode)} {awayTeamName}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground shrink-0">
                                {match.scheduledAt.toLocaleTimeString("sv-SE", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Europe/Stockholm",
                                })}
                              </span>
                            </div>

                            {/* Action */}
                            <div className="shrink-0">
                              {match.isResultConfirmed ? (
                                <span className="text-sm font-mono font-bold text-green-700">
                                  {match.homeScore} – {match.awayScore} ✓
                                </span>
                              ) : isTbd ? (
                                <TeamAssignForm
                                  matchId={match.id}
                                  homeSlot={homeSlot}
                                  awaySlot={awaySlot}
                                  teams={teamOptions}
                                />
                              ) : (
                                <ResultForm matchId={match.id} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
