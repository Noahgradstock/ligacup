import { auth } from "@clerk/nextjs/server";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, notifications, leagues } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import Link from "next/link";

function formatPayload(type: string, payload: Record<string, unknown>): string {
  if (type === "rank_overtaken") {
    const { overtakerName, newRank, oldRank } = payload as {
      overtakerName: string;
      newRank: number;
      oldRank: number;
    };
    return `${overtakerName} gick om dig! Du föll från plats #${oldRank} till #${newRank}.`;
  }
  return "Ny notifikation";
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just nu";
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  return `${Math.floor(hours / 24)}d sedan`;
}

export default async function NotificationsPage() {
  const { userId: clerkId } = await auth();

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

  return (
    <main className="flex flex-col min-h-screen">
      <AppNav />

      <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Notifikationer</h1>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-muted-foreground text-sm">
            Inga notifikationer ännu.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((n) => {
              const payload = (n.payload ?? {}) as Record<string, unknown>;
              const leagueId = payload.leagueId as string | undefined;
              const text = formatPayload(n.type, payload);

              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
                    n.isRead ? "border-border bg-card" : "border-primary/20 bg-primary/5"
                  }`}
                >
                  <div className="mt-0.5 w-2 h-2 rounded-full shrink-0 mt-2">
                    {!n.isRead && <span className="block w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{text}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                      {leagueId && (
                        <Link
                          href={`/league/${leagueId}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Visa tabellen →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
