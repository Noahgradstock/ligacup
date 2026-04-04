import { redirect } from "next/navigation";
import { eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { predictions, leagueMembers, pointSnapshots } from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { ProfileForm } from "./profile-form";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const user = await syncCurrentUser();
  if (!user) redirect("/sign-in");

  // Stats
  const [[{ value: predCount }], [{ value: leagueCount }], bestRank] =
    await Promise.all([
      db.select({ value: count() }).from(predictions).where(eq(predictions.userId, user.id)),
      db
        .select({ value: count() })
        .from(leagueMembers)
        .where(eq(leagueMembers.userId, user.id)),
      db
        .select({ rankInLeague: pointSnapshots.rankInLeague, totalPoints: pointSnapshots.totalPoints })
        .from(pointSnapshots)
        .where(eq(pointSnapshots.userId, user.id))
        .orderBy(pointSnapshots.totalPoints)
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

  const initials = (user.displayName ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav />

      <div className="max-w-md mx-auto w-full px-4 py-10 flex flex-col gap-8">
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {initials}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{user.displayName ?? user.email.split("@")[0]}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Tips", value: predCount },
            { label: "Tipslag", value: leagueCount },
            {
              label: "Bästa rank",
              value: bestRank?.rankInLeague != null ? `#${bestRank.rankInLeague}` : "–",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-4"
            >
              <span className="text-xl font-bold tabular-nums">{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Edit name */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">Redigera profil</h2>
          <ProfileForm initialName={user.displayName ?? ""} />
        </section>

        {/* Sign out */}
        <section className="flex flex-col gap-2 pt-4 border-t border-border">
          <SignOutButton redirectUrl="/">
            <Button variant="outline" className="w-full text-destructive hover:text-destructive">
              Logga ut
            </Button>
          </SignOutButton>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
