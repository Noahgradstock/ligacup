import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { leagues, leagueMembers, users, pointSnapshots } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId: clerkId } = await auth();

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, id))
    .limit(1);

  if (!league) notFound();

  // Resolve current user
  const dbUser = clerkId
    ? (await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1))[0] ?? null
    : null;

  // Members with display info
  const members = await db
    .select({
      userId: leagueMembers.userId,
      joinedAt: leagueMembers.joinedAt,
      displayName: users.displayName,
      email: users.email,
    })
    .from(leagueMembers)
    .innerJoin(users, eq(leagueMembers.userId, users.id))
    .where(and(eq(leagueMembers.leagueId, id), eq(leagueMembers.isActive, true)))
    .orderBy(leagueMembers.joinedAt);

  // Leaderboard from point_snapshots (empty until results confirmed)
  const leaderboard = await db
    .select({
      userId: pointSnapshots.userId,
      totalPoints: pointSnapshots.totalPoints,
      rankInLeague: pointSnapshots.rankInLeague,
      exactScores: pointSnapshots.exactScores,
      correctWinners: pointSnapshots.correctWinners,
      displayName: users.displayName,
      email: users.email,
    })
    .from(pointSnapshots)
    .innerJoin(users, eq(pointSnapshots.userId, users.id))
    .where(eq(pointSnapshots.leagueId, id))
    .orderBy(pointSnapshots.totalPoints);

  const isMember = dbUser ? members.some((m) => m.userId === dbUser.id) : false;
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${league.inviteCode}`;

  function displayLabel(m: { displayName: string | null; email: string }) {
    return m.displayName ?? m.email.split("@")[0];
  }

  return (
    <main className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
        </Link>
        <Link href="/predictions">
          <Button variant="outline" size="sm">⚽ Tippa matcher</Button>
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{league.name}</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "deltagare" : "deltagare"} · VM 2026
          </p>
        </div>

        {/* Invite */}
        {isMember && (
          <section className="rounded-lg border border-border bg-secondary/50 px-4 py-4 flex flex-col gap-3">
            <p className="text-sm font-medium">Bjud in vänner</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none"
              />
              <CopyButton text={inviteUrl} />
            </div>
            <p className="text-xs text-muted-foreground">
              Kod: <span className="font-semibold font-mono">{league.inviteCode}</span>
            </p>
          </section>
        )}

        {/* Leaderboard */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Tabellen</h2>
          {leaderboard.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-muted-foreground text-sm">
              Inga poäng ännu. Poäng beräknas när matchresultat bekräftas.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.userId}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card"
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">
                    {displayLabel(entry)}
                    {dbUser && entry.userId === dbUser.id && (
                      <span className="ml-2 text-xs text-primary">(du)</span>
                    )}
                  </span>
                  <span className="text-sm font-bold">{entry.totalPoints}p</span>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {entry.exactScores} exakta · {entry.correctWinners} rätta
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Members */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Deltagare</h2>
          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card"
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                  {displayLabel(m).slice(0, 1)}
                </div>
                <span className="text-sm">
                  {displayLabel(m)}
                  {dbUser && m.userId === dbUser.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(du)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

