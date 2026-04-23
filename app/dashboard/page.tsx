import Link from "next/link";
import { cookies } from "next/headers";
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
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

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

  const cookieJar = await cookies();
  const locale = (cookieJar.get("ligacup_locale")?.value ?? dbUser.locale ?? "sv") as Locale;

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
            {t("wcCountdownPrefix", locale)} {daysUntilWC} {t("daysLeft", locale)}
          </div>

          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {firstName ? `${t("greeting", locale)}, ${firstName}! ⚽` : t("welcomeTitle", locale)}
            </h1>
            <p className="text-white/55 text-sm mt-1.5 leading-relaxed">
              {leagueCards.length === 0
                ? t("dashSubNoLeague", locale)
                : t("dashSubHasLeague", locale)}
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-2.5">
            <Link href="/league/new">
              <Button
                className="font-bold border-0 shadow-none"
                style={{ background: "#e6a800", color: "#0d1f3c" }}
              >
                {t("createLeagueCta", locale)}
              </Button>
            </Link>
            <Link href="/join">
              <Button
                variant="outline"
                className="border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white"
              >
                {t("joinByCode", locale)}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Leagues */}
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">{t("yourLeagues", locale)}</h2>
          {leagueCards.length > 0 && (
            <span className="text-xs text-muted-foreground">{leagueCards.length} {t("leagues", locale)}</span>
          )}
        </div>

        {leagueCards.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-5 py-14 px-6 rounded-xl border border-dashed border-border bg-secondary/20">
            <div className="text-4xl">🏆</div>
            <div className="flex flex-col gap-1.5">
              <p className="font-semibold text-sm">{t("notInAnyLeague", locale)}</p>
              <p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
                {t("notInAnyLeagueDesc", locale)}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
              <Link href="/league/new" className="flex-1">
                <Button className="w-full font-semibold">{t("createLeagueShort", locale)}</Button>
              </Link>
              <Link href="/join" className="flex-1">
                <Button className="w-full" variant="outline">{t("joinByCode", locale)}</Button>
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
