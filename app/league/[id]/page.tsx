import { eq, and, lt, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  leagues,
  leagueMembers,
  users,
  pointSnapshots,
  matches,
  tournamentRounds,
  predictions,
  teams,
  tournamentTop3Predictions,
} from "@/lib/db/schema";
import { redis, keys } from "@/lib/redis";
import { CopyButton } from "./copy-button";
import { Leaderboard } from "@/components/leaderboard";
import { DeleteLeagueButton } from "./delete-league-button";
import { syncCurrentUser } from "@/lib/sync-user";
import { MemberPredictionsSection } from "@/components/member-predictions-section";
import type { LeaderboardEntry } from "@/app/api/leagues/[id]/leaderboard/route";
import type { Top3Entry } from "@/app/api/leagues/[id]/top3/route";

function toFlag(code: string | null) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

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

  // ── "Allas tips" data ──────────────────────────────────────────────────────

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");
  const now = new Date();

  // Locked group matches (scheduledAt in the past)
  const lockedMatchRows = await db
    .select({
      matchId: matches.id,
      groupName: matches.groupName,
      scheduledAt: matches.scheduledAt,
      homeTeamName: homeTeam.name,
      homeTeamCode: homeTeam.countryCode,
      awayTeamName: awayTeam.name,
      awayTeamCode: awayTeam.countryCode,
      isResultConfirmed: matches.isResultConfirmed,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(
      and(
        eq(matches.tournamentId, league.tournamentId),
        eq(tournamentRounds.roundType, "GROUP"),
        lt(matches.scheduledAt, now)
      )
    )
    .orderBy(matches.scheduledAt);

  // All predictions for those matches scoped to this league
  const matchPredRows =
    lockedMatchRows.length > 0
      ? await db
          .select({
            matchId: predictions.matchId,
            userId: predictions.userId,
            homeScorePred: predictions.homeScorePred,
            awayScorePred: predictions.awayScorePred,
          })
          .from(predictions)
          .where(
            and(
              inArray(
                predictions.matchId,
                lockedMatchRows.map((r) => r.matchId)
              ),
              eq(predictions.leagueId, id)
            )
          )
      : [];

  // Build lockedMatches with nested predictions
  const predsByMatch = new Map<string, { userId: string; home: number; away: number }[]>();
  for (const p of matchPredRows) {
    if (!predsByMatch.has(p.matchId)) predsByMatch.set(p.matchId, []);
    predsByMatch.get(p.matchId)!.push({ userId: p.userId, home: p.homeScorePred, away: p.awayScorePred });
  }

  const lockedMatches = lockedMatchRows.map((r) => ({
    matchId: r.matchId,
    groupName: r.groupName,
    scheduledAt: r.scheduledAt.toISOString(),
    homeTeamName: r.homeTeamName,
    homeTeamCode: r.homeTeamCode,
    awayTeamName: r.awayTeamName,
    awayTeamCode: r.awayTeamCode,
    isResultConfirmed: r.isResultConfirmed,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    predictions: predsByMatch.get(r.matchId) ?? [],
  }));

  // All distinct group names (independent of whether matches are locked yet)
  const allGroupRows = await db
    .selectDistinct({ groupName: matches.groupName })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .where(
      and(
        eq(matches.tournamentId, league.tournamentId),
        eq(tournamentRounds.roundType, "GROUP")
      )
    );
  const groups = allGroupRows
    .map((r) => r.groupName)
    .filter((g): g is string => g !== null)
    .sort();

  // Top 3 VM predictions for this league
  const t1 = alias(teams, "t1");
  const t2 = alias(teams, "t2");
  const t3 = alias(teams, "t3");

  const top3Rows = await db
    .select({
      userId: tournamentTop3Predictions.userId,
      firstTeamId: tournamentTop3Predictions.firstTeamId,
      firstTeamName: t1.name,
      firstTeamCode: t1.countryCode,
      secondTeamId: tournamentTop3Predictions.secondTeamId,
      secondTeamName: t2.name,
      secondTeamCode: t2.countryCode,
      thirdTeamId: tournamentTop3Predictions.thirdTeamId,
      thirdTeamName: t3.name,
      thirdTeamCode: t3.countryCode,
    })
    .from(tournamentTop3Predictions)
    .leftJoin(t1, eq(tournamentTop3Predictions.firstTeamId, t1.id))
    .leftJoin(t2, eq(tournamentTop3Predictions.secondTeamId, t2.id))
    .leftJoin(t3, eq(tournamentTop3Predictions.thirdTeamId, t3.id))
    .where(eq(tournamentTop3Predictions.leagueId, id));

  const top3: Top3Entry[] = top3Rows.map((r) => ({
    userId: r.userId,
    firstTeamId: r.firstTeamId,
    firstTeamName: r.firstTeamName,
    firstTeamCode: r.firstTeamCode,
    secondTeamId: r.secondTeamId,
    secondTeamName: r.secondTeamName,
    secondTeamCode: r.secondTeamCode,
    thirdTeamId: r.thirdTeamId,
    thirdTeamName: r.thirdTeamName,
    thirdTeamCode: r.thirdTeamCode,
  }));

  // All teams for the top3 picker
  const allTeams = await db
    .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
    .from(teams)
    .orderBy(teams.name);

  // ──────────────────────────────────────────────────────────────────────────

  const isMember = dbUser ? members.some((m) => m.userId === dbUser.id) : false;
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${league.inviteCode}`;

  function displayLabel(m: { displayName: string | null; email: string }) {
    return m.displayName ?? m.email.split("@")[0];
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-10">
      {/* Meta */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {members.length} deltagare · VM 2026
        </p>
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

      {/* All members' predictions */}
      <MemberPredictionsSection
        leagueId={id}
        currentUserId={dbUser?.id ?? null}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          email: m.email,
          avatarUrl: m.avatarUrl ?? null,
        }))}
        lockedMatches={lockedMatches}
        top3={top3}
        allTeams={allTeams.map((t) => ({ id: t.id, name: t.name, countryCode: t.countryCode }))}
        groups={groups}
      />

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
