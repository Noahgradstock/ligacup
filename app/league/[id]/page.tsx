import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  users,
  pointSnapshots,
} from "@/lib/db/schema";
import { redis, keys } from "@/lib/redis";
import { CopyButton } from "./copy-button";
import { Leaderboard } from "@/components/leaderboard";
import { DeleteLeagueButton } from "./delete-league-button";
import { syncCurrentUser } from "@/lib/sync-user";
import type { LeaderboardEntry } from "@/app/api/leagues/[id]/leaderboard/route";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [league, dbUser] = await Promise.all([
    db.select().from(leagues).where(eq(leagues.id, id)).limit(1).then((r) => r[0] ?? null),
    syncCurrentUser(),
  ]);

  if (!league) notFound();

  const members = await db
    .select({
      userId: leagueMembers.userId,
      joinedAt: leagueMembers.joinedAt,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(leagueMembers)
    .innerJoin(users, eq(leagueMembers.userId, users.id))
    .where(and(eq(leagueMembers.leagueId, id), eq(leagueMembers.isActive, true)))
    .orderBy(leagueMembers.joinedAt);

  // Initial leaderboard — try Redis, fall back to Postgres
  let initialLeaderboard: LeaderboardEntry[] = [];
  try {
    const raw = await redis.zrevrange(keys.leaderboard(id), 0, -1, "WITHSCORES");
    if (raw.length > 0) {
      for (let i = 0; i < raw.length; i += 2) {
        const member = JSON.parse(raw[i]);
        initialLeaderboard.push({ ...member, totalPoints: parseInt(raw[i + 1], 10), rank: initialLeaderboard.length + 1 });
      }
      // Overlay fresh displayName/avatarUrl — members is already fetched from DB above
      const memberMap = new Map(members.map((m) => [m.userId, m]));
      initialLeaderboard = initialLeaderboard.map((entry) => {
        const fresh = memberMap.get(entry.userId);
        return fresh
          ? { ...entry, displayName: fresh.displayName, email: fresh.email, avatarUrl: fresh.avatarUrl ?? null }
          : entry;
      });
    }
  } catch {
    // Redis unavailable — use Postgres
  }

  if (initialLeaderboard.length === 0) {
    const rows = await db
      .select({
        userId: pointSnapshots.userId,
        totalPoints: pointSnapshots.totalPoints,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(pointSnapshots)
      .innerJoin(users, eq(pointSnapshots.userId, users.id))
      .where(eq(pointSnapshots.leagueId, id));

    initialLeaderboard = [...rows]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((r, i) => ({ ...r, avatarUrl: r.avatarUrl ?? null, rank: i + 1 }));
  }

  const isMember = dbUser ? members.some((m) => m.userId === dbUser.id) : false;
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${league.inviteCode}`;

  function displayLabel(m: { displayName: string | null; email: string }) {
    return m.displayName ?? m.email.split("@")[0];
  }

  const config = league.configJson as { features?: string[]; scoring?: object; entryFee?: number } | null;
  const entryFee = config?.entryFee ?? null;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-10">
      {/* Meta */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {members.length} deltagare · VM 2026
        </p>
        {entryFee && entryFee > 0 && (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 w-fit">
            <span className="text-base">🏅</span>
            <div className="text-xs">
              <span className="font-semibold text-amber-800 dark:text-amber-400">
                Insats: {entryFee} kr/person
              </span>
              <span className="text-amber-700/70 dark:text-amber-500/70 mx-1.5">·</span>
              <span className="text-amber-700/70 dark:text-amber-500/70">
                Pott: {entryFee * members.length} kr
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Live leaderboard */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Tabellen</h2>
        <Leaderboard
          leagueId={id}
          currentUserId={dbUser?.id ?? null}
          initial={initialLeaderboard}
        />
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
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt={displayLabel(m)} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase shrink-0">
                  {displayLabel(m).slice(0, 1)}
                </div>
              )}
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

      {/* Owner settings */}
      {dbUser && league.ownerId === dbUser.id && (
        <section className="flex flex-col gap-2 pt-4 border-t border-border">
          <DeleteLeagueButton leagueId={id} leagueName={league.name} />
        </section>
      )}
    </div>
  );
}
