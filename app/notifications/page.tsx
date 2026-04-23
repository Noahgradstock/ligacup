import { auth } from "@clerk/nextjs/server";
import { eq, desc, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, notifications, leagues } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

function getIcon(type: string): string {
  switch (type) {
    case "rank_overtaken":    return "📉";
    case "prediction_result": return "⚽";
    case "member_joined":     return "👋";
    case "mention":           return "💬";
    default:                  return "🔔";
  }
}

function formatPayload(
  type: string,
  payload: Record<string, unknown>,
  leagueName?: string
): string {
  const inLeague = leagueName ? ` i ${leagueName}` : "";

  if (type === "rank_overtaken") {
    const { overtakerName, newRank, oldRank } = payload as {
      overtakerName: string;
      newRank: number;
      oldRank: number;
    };
    return `${overtakerName} gick om dig${inLeague}! Du föll från plats #${oldRank} till #${newRank}.`;
  }

  if (type === "prediction_result") {
    const { homeTeam, awayTeam, homeScore, awayScore, homePred, awayPred, points, isExact } =
      payload as {
        homeTeam: string;
        awayTeam: string;
        homeScore: number;
        awayScore: number;
        homePred: number;
        awayPred: number;
        points: number;
        isExact: boolean;
      };
    const outcome = isExact
      ? "Exakt rätt!"
      : (points as number) > 0
      ? "Rätt utgång!"
      : "Fel den här gången.";
    return `${homeTeam} ${homeScore}–${awayScore} ${awayTeam} — du tippade ${homePred}–${awayPred}. ${outcome} +${points}p`;
  }

  if (type === "member_joined") {
    const { joinerName, leagueName: ln } = payload as {
      joinerName: string;
      leagueName?: string;
    };
    return `${joinerName} gick med i ${ln ?? "din liga"}!`;
  }

  if (type === "mention") {
    const { mentionerName, messagePreview } = payload as {
      mentionerName: string;
      messagePreview: string;
    };
    return `${mentionerName} nämnde dig${inLeague}: "${messagePreview}"`;
  }

  return "Ny notifikation";
}

function timeAgo(date: Date, locale: Locale): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return locale === "en" ? "just now" : "Just nu";
  if (mins < 60) return `${mins} ${locale === "en" ? "min ago" : "min sedan"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${locale === "en" ? "ago" : "sedan"}`;
  return `${Math.floor(hours / 24)}d ${locale === "en" ? "ago" : "sedan"}`;
}

function getDayLabel(date: Date, locale: Locale): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = todayStart - dateStart;
  if (diff === 0) return t("today", locale);
  if (diff === 86_400_000) return t("yesterday", locale);
  return t("earlier", locale);
}

async function clearAllNotifications() {
  "use server";
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return;
  await db.delete(notifications).where(eq(notifications.userId, user.id));
  revalidatePath("/notifications");
}

export default async function NotificationsPage() {
  const { userId: clerkId } = await auth();
  const cookieJar = await cookies();
  const locale = (cookieJar.get("ligacup_locale")?.value ?? "sv") as Locale;

  const [user] = clerkId
    ? await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
    : [undefined];

  const rows = user
    ? await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50)
    : [];

  // Mark all as read on page load
  if (user && rows.some((r) => !r.isRead)) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
  }

  // Fetch league names for notifications that have a leagueId in payload
  const leagueIds = [
    ...new Set(
      rows
        .map((n) => (n.payload as Record<string, unknown>)?.leagueId as string | undefined)
        .filter((id): id is string => !!id)
    ),
  ];
  const leagueRows =
    leagueIds.length > 0
      ? await db
          .select({ id: leagues.id, name: leagues.name })
          .from(leagues)
          .where(inArray(leagues.id, leagueIds))
      : [];
  const leagueMap = new Map(leagueRows.map((l) => [l.id, l.name]));

  // Group by day label
  const groups: { label: string; items: typeof rows }[] = [];
  for (const n of rows) {
    const label = getDayLabel(n.createdAt, locale);
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.items.push(n);
    } else {
      groups.push({ label, items: [n] });
    }
  }

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav />

      <section className="relative bg-[#0d1f3c] px-6 py-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="max-w-2xl mx-auto relative flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">{t("notificationsTitle", locale)}</h1>
          {rows.length > 0 && (
            <form action={clearAllNotifications}>
              <button
                type="submit"
                className="text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                {t("clearAll", locale)}
              </button>
            </form>
          )}
        </div>
      </section>

      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-muted-foreground text-sm">
            {locale === "en" ? "No notifications yet." : "Inga notifikationer ännu."}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                  {group.label}
                </p>
                {group.items.map((n) => {
                  const payload = (n.payload ?? {}) as Record<string, unknown>;
                  const leagueId = payload.leagueId as string | undefined;
                  const leagueName = leagueId ? leagueMap.get(leagueId) : undefined;
                  const text = formatPayload(n.type, payload, leagueName);
                  const icon = getIcon(n.type);

                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
                        n.isRead
                          ? "border-border bg-card"
                          : "border-primary/20 bg-primary/5"
                      }`}
                    >
                      <span className="text-base shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{text}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(n.createdAt, locale)}
                          </span>
                          {leagueId && n.type !== "member_joined" && (
                            <Link
                              href={`/league/${leagueId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              {n.type === "mention" ? t("viewChat", locale) : t("viewStandings", locale)}
                            </Link>
                          )}
                        </div>
                      </div>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
