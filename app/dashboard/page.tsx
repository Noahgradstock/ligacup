import Link from "next/link";
import { eq, and, count, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  pointSnapshots,
} from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { LeagueCardList } from "@/components/league-card-list";
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

  const leagueCards = leagueRows.map((league) => {
    const snap = snapshotByLeague.get(league.id);
    return {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      totalPoints: snap?.totalPoints ?? 0,
      rankInLeague: snap?.rankInLeague ?? null,
      matchesPlayed: snap?.matchesPlayed ?? 0,
      memberCount: countByLeague.get(league.id) ?? 1,
      isOwner: dbUser ? league.ownerId === dbUser.id : false,
    };
  });

  const displayName = dbUser?.displayName ?? dbUser?.email?.split("@")[0] ?? "";

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
            <LeagueCardList cards={leagueCards} />
          )}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
