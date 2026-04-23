import Link from "next/link";
import { redirect } from "next/navigation";
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
  const dbUser = await syncCurrentUser();
  if (!dbUser) redirect("/sign-in");

  const memberships = await db
    .select({ leagueId: leagueMembers.leagueId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.userId, dbUser.id), eq(leagueMembers.isActive, true)));
  const leagueIds = memberships.map((m) => m.leagueId);

  const leagueRows =
    leagueIds.length > 0
      ? await db.select().from(leagues).where(inArray(leagues.id, leagueIds))
      : [];

  const snapshotRows =
    leagueIds.length > 0
      ? await db
          .select()
          .from(pointSnapshots)
          .where(and(eq(pointSnapshots.userId, dbUser.id), inArray(pointSnapshots.leagueId, leagueIds)))
      : [];

  const memberCountRows =
    leagueIds.length > 0
      ? await db
          .select({ leagueId: leagueMembers.leagueId, value: count() })
          .from(leagueMembers)
          .where(and(inArray(leagueMembers.leagueId, leagueIds), eq(leagueMembers.isActive, true)))
          .groupBy(leagueMembers.leagueId)
      : [];

  const snapshotByLeague = new Map(snapshotRows.map((s) => [s.leagueId, s]));
  const countByLeague = new Map(memberCountRows.map((r) => [r.leagueId, r.value]));

  const leagueCards = leagueRows.map((league) => {
    const snap = snapshotByLeague.get(league.id);
    return {
      id: league.id,
      name: league.name,
      bannerUrl: league.bannerUrl ?? null,
      inviteCode: league.inviteCode,
      totalPoints: snap?.totalPoints ?? 0,
      rankInLeague: snap?.rankInLeague ?? null,
      matchesPlayed: snap?.matchesPlayed ?? 0,
      memberCount: countByLeague.get(league.id) ?? 1,
      isOwner: league.ownerId === dbUser.id,
    };
  });

  const displayName = dbUser.displayName ?? dbUser.email?.split("@")[0] ?? "";
  const firstName = displayName.split(" ")[0];

  const wcStart = new Date("2026-06-11T00:00:00Z");
  const daysUntilWC = Math.max(0, Math.ceil((wcStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav />

      {/* Hero */}
      <section className="relative bg-[#0d1f3c] px-6 py-9 overflow-hidden">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="max-w-2xl mx-auto relative flex flex-col gap-5">
          {/* Countdown badge */}
          <div className="inline-flex items-center gap-2 w-fit bg-white/10 text-white/70 text-xs px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
            VM 2026 startar 11 juni — {daysUntilWC} dagar kvar
          </div>

          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {firstName ? `Hej, ${firstName}! ⚽` : "Välkommen! ⚽"}
            </h1>
            <p className="text-white/55 text-sm mt-1.5 leading-relaxed">
              {leagueCards.length === 0
                ? "Skapa ett tipslag och bjud in dina vänner — se vem som har koll på fotboll."
                : "Tippa matcherna, följ tabellen och se vem som leder i dina tipslag."}
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-2.5">
            <Link href="/league/new">
              <Button
                className="font-bold border-0 shadow-none"
                style={{ background: "#e6a800", color: "#0d1f3c" }}
              >
                + Skapa tipslag
              </Button>
            </Link>
            <Link href="/join">
              <Button
                variant="outline"
                className="border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white"
              >
                Gå med via kod
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Leagues */}
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">Dina tipslag</h2>
          {leagueCards.length > 0 && (
            <span className="text-xs text-muted-foreground">{leagueCards.length} lag</span>
          )}
        </div>

        {leagueCards.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-5 py-14 px-6 rounded-xl border border-dashed border-border bg-secondary/20">
            <div className="text-4xl">🏆</div>
            <div className="flex flex-col gap-1.5">
              <p className="font-semibold text-sm">Du är inte med i något tipslag ännu</p>
              <p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
                Skapa ett lag och bjud in vänner, eller gå med i ett befintligt lag via en inbjudningskod.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
              <Link href="/league/new" className="flex-1">
                <Button className="w-full font-semibold">Skapa tipslag</Button>
              </Link>
              <Link href="/join" className="flex-1">
                <Button className="w-full" variant="outline">Gå med via kod</Button>
              </Link>
            </div>
          </div>
        ) : (
          <LeagueCardList cards={leagueCards} />
        )}
      </div>

      <BottomNav />
    </main>
  );
}
