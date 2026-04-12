import { eq, and, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { leagues, leagueMembers } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { syncCurrentUser } from "@/lib/sync-user";

export default async function BracketPickerPage() {
  const dbUser = await syncCurrentUser();
  if (!dbUser) redirect("/sign-in");

  const memberships = await db
    .select({ leagueId: leagueMembers.leagueId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.userId, dbUser.id), eq(leagueMembers.isActive, true)));

  const leagueIds = memberships.map((m) => m.leagueId);

  if (leagueIds.length === 0) {
    return (
      <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
        <AppNav backHref="/dashboard" />
        <div className="max-w-2xl mx-auto w-full px-4 py-16 flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-semibold">Du är inte med i något tipslag</p>
          <Link
            href="/league/new"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Skapa tipslag
          </Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  if (leagueIds.length === 1) {
    redirect(`/league/${leagueIds[0]}/bracket`);
  }

  const leagueRows = await db
    .select()
    .from(leagues)
    .where(inArray(leagues.id, leagueIds));

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav backHref="/dashboard" />
      <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slutspelet</h1>
          <p className="text-muted-foreground text-sm mt-1">Välj tipslag</p>
        </div>
        <div className="flex flex-col gap-2">
          {leagueRows.map((league) => (
            <Link
              key={league.id}
              href={`/league/${league.id}/bracket`}
              className="flex items-center justify-between px-4 py-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors"
            >
              <span className="font-semibold">{league.name}</span>
              <span className="text-muted-foreground text-lg">›</span>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
