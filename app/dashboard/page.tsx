import Link from "next/link";
import { eq, and, count, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  pointSnapshots,
  predictions,
  matches,
  tournaments,
} from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { syncCurrentUser } from "@/lib/sync-user";

export default async function DashboardPage() {
  // Auto-sync Clerk → DB on every dashboard load (idempotent upsert)
  const dbUser = await syncCurrentUser();

  // 1. Which leagues is the user a member of?
  const memberships = dbUser
    ? await db
        .select({ leagueId: leagueMembers.leagueId })
        .from(leagueMembers)
        .where(and(eq(leagueMembers.userId, dbUser.id), eq(leagueMembers.isActive, true)))
    : [];
  const leagueIds = memberships.map((m) => m.leagueId);

  // 2. Batch-fetch leagues, snapshots, and member counts
  const leagueRows =
    leagueIds.length > 0
      ? await db.select().from(leagues).where(inArray(leagues.id, leagueIds))
      : [];

  const snapshotRows =
    dbUser && leagueIds.length > 0
      ? await db
          .select()
          .from(pointSnapshots)
          .where(
            and(
              eq(pointSnapshots.userId, dbUser.id),
              inArray(pointSnapshots.leagueId, leagueIds)
            )
          )
      : [];

  const memberCountRows =
    leagueIds.length > 0
      ? await db
          .select({ leagueId: leagueMembers.leagueId, value: count() })
          .from(leagueMembers)
          .where(
            and(
              inArray(leagueMembers.leagueId, leagueIds),
              eq(leagueMembers.isActive, true)
            )
          )
          .groupBy(leagueMembers.leagueId)
      : [];

  const snapshotByLeague = new Map(snapshotRows.map((s) => [s.leagueId, s]));
  const countByLeague = new Map(memberCountRows.map((r) => [r.leagueId, r.value]));

  type LeagueCard = {
    id: string;
    name: string;
    inviteCode: string;
    totalPoints: number;
    rankInLeague: number | null;
    matchesPlayed: number;
    memberCount: number;
  };

  const leagueCards: LeagueCard[] = leagueRows.map((league) => {
    const snap = snapshotByLeague.get(league.id);
    return {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      totalPoints: snap?.totalPoints ?? 0,
      rankInLeague: snap?.rankInLeague ?? null,
      matchesPlayed: snap?.matchesPlayed ?? 0,
      memberCount: countByLeague.get(league.id) ?? 1,
    };
  });

  // 3. Prediction progress
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, "vm-2026"))
    .limit(1);

  const [{ value: totalMatches }] = tournament
    ? await db
        .select({ value: count() })
        .from(matches)
        .where(eq(matches.tournamentId, tournament.id))
    : [{ value: 0 }];

  const [{ value: predictedCount }] = dbUser
    ? await db
        .select({ value: count() })
        .from(predictions)
        .where(eq(predictions.userId, dbUser.id))
    : [{ value: 0 }];

  const displayName = dbUser?.displayName ?? dbUser?.email?.split("@")[0] ?? "";
  const progress = totalMatches > 0 ? Math.round((predictedCount / totalMatches) * 100) : 0;

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav rightSlot={<span className="text-sm text-muted-foreground truncate max-w-[120px]">{displayName}</span>} />

      {/* Quick actions */}
      <section className="border-b border-border px-6 py-3 flex gap-2 flex-wrap">
        <Link href="/predictions">
          <Button variant="outline" size="sm">⚽ Tippa matcher</Button>
        </Link>
        <Link href="/league/new">
          <Button variant="outline" size="sm">+ Skapa tipslag</Button>
        </Link>
        <Link href="/join">
          <Button variant="outline" size="sm">Gå med via länk</Button>
        </Link>
      </section>

      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-10">

        {/* Prediction progress */}
        {tournament && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Dina tips</h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {predictedCount}/{totalMatches} matcher
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            {predictedCount === totalMatches && totalMatches > 0 ? (
              <p className="text-xs text-center text-green-600 font-medium">
                Alla matcher tippade ✓
              </p>
            ) : (
              <Link href="/predictions">
                <Button size="sm" variant="outline" className="w-full">
                  {predictedCount === 0 ? "Börja tippa →" : "Fortsätt tippa →"}
                </Button>
              </Link>
            )}
          </section>
        )}

        {/* Leagues */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold tracking-tight">Dina tipslag</h2>

          {leagueCards.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-4 py-12 rounded-lg border border-dashed border-border">
              <p className="text-muted-foreground text-sm">
                Du är inte med i något tipslag ännu.
              </p>
              <div className="flex gap-3">
                <Link href="/league/new">
                  <Button size="sm">Skapa tipslag</Button>
                </Link>
                <Link href="/join">
                  <Button size="sm" variant="outline">Gå med via länk</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {leagueCards.map((card) => (
                <Link key={card.id} href={`/league/${card.id}`}>
                  <div className="flex items-center gap-4 px-5 py-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors cursor-pointer">
                    {/* Rank badge */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        card.rankInLeague === 1
                          ? "bg-yellow-100 text-yellow-700"
                          : card.rankInLeague === 2
                          ? "bg-slate-100 text-slate-600"
                          : card.rankInLeague === 3
                          ? "bg-orange-100 text-orange-700"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {card.rankInLeague ? `#${card.rankInLeague}` : "–"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.memberCount}{" "}
                        {card.memberCount === 1 ? "deltagare" : "deltagare"}
                        {card.matchesPlayed > 0 &&
                          ` · ${card.matchesPlayed} match${card.matchesPlayed === 1 ? "" : "er"} spelade`}
                      </p>
                    </div>

                    {/* Points */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold tabular-nums">{card.totalPoints}p</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
