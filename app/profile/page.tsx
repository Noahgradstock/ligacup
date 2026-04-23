import { redirect } from "next/navigation";
import { eq, count } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { predictions, leagueMembers, pointSnapshots } from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { ProfileForm } from "./profile-form";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export default async function ProfilePage() {
  const user = await syncCurrentUser();
  if (!user) redirect("/sign-in");

  const cookieJar = await cookies();
  const locale = (cookieJar.get("ligacup_locale")?.value ?? user.locale ?? "sv") as Locale;

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

      <section className="relative bg-[#0d1f3c] px-6 py-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="max-w-md mx-auto relative flex items-center gap-4">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={initials} className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xl font-bold text-white shrink-0">
              {initials}
            </div>
          )}
          <div>
            <p className="text-xl font-bold text-white leading-tight">{user.displayName ?? user.email.split("@")[0]}</p>
            <p className="text-sm text-white/50 mt-0.5">{user.email}</p>
          </div>
        </div>
      </section>

      <div className="max-w-md mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("predictionsStat", locale), value: predCount },
            { label: t("leaguesStat", locale), value: leagueCount },
            {
              label: t("bestRankStat", locale),
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

        {/* Edit name + language */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">{t("editProfileTitle", locale)}</h2>
          <ProfileForm initialName={user.displayName ?? ""} initialLocale={locale} />
        </section>

        {/* Sign out */}
        <section className="flex flex-col gap-2 pt-4 border-t border-border">
          <SignOutButton redirectUrl="/">
            <Button variant="outline" className="w-full text-destructive hover:text-destructive">
              {t("signOut", locale)}
            </Button>
          </SignOutButton>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
