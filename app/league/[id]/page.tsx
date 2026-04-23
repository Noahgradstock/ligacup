import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
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
import { ShareTipsButton } from "./share-tips-button";
import { syncCurrentUser } from "@/lib/sync-user";
import type { LeaderboardEntry } from "@/app/api/leagues/[id]/leaderboard/route";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

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

  const cookieJar = await cookies();
  const locale = (cookieJar.get("ligacup_locale")?.value ?? dbUser?.locale ?? "sv") as Locale;

  function displayLabel(m: { displayName: string | null; email: string }) {
    return m.displayName ?? m.email.split("@")[0];
  }

  const config = league.configJson as {
    features?: string[];
    scoring?: { exactScore?: number; correctWinner?: number; correctDraw?: number; topScorerPoints?: number; yellowCardsPoints?: number };
    entryFee?: number;
  } | null;
  const entryFee = config?.entryFee ?? null;
  const features = config?.features ?? [];
  const scoring = config?.scoring ?? {};

  const FEATURE_LABELS: Record<string, string> = locale === "en" ? {
    match_scores: "⚽ Match results",
    tournament_winner: "🏆 World Cup Top 3",
    top_scorer: "👟 Top scorer",
    most_yellow_cards: "🟨 Most yellow cards",
  } : {
    match_scores: "⚽ Matchresultat",
    tournament_winner: "🏆 VM Top 3",
    top_scorer: "👟 Skyttekung",
    most_yellow_cards: "🟨 Flest gula kort",
  };

  const scoringParts: string[] = [];
  if (locale === "en") {
    if (scoring.exactScore != null) scoringParts.push(`Exact: ${scoring.exactScore}pts`);
    if (scoring.correctWinner != null) scoringParts.push(`Correct result: ${scoring.correctWinner}pts`);
    if (scoring.topScorerPoints != null && features.includes("top_scorer")) scoringParts.push(`Top scorer: ${scoring.topScorerPoints}pts`);
    if (scoring.yellowCardsPoints != null && features.includes("most_yellow_cards")) scoringParts.push(`Yellow cards: ${scoring.yellowCardsPoints}pts`);
    if (entryFee && entryFee > 0) scoringParts.push(`Entry: ${entryFee} kr/p`);
  } else {
    if (scoring.exactScore != null) scoringParts.push(`Exakt: ${scoring.exactScore}p`);
    if (scoring.correctWinner != null) scoringParts.push(`Rätt utgång: ${scoring.correctWinner}p`);
    if (scoring.topScorerPoints != null && features.includes("top_scorer")) scoringParts.push(`Skyttekung: ${scoring.topScorerPoints}p`);
    if (scoring.yellowCardsPoints != null && features.includes("most_yellow_cards")) scoringParts.push(`Gula kort: ${scoring.yellowCardsPoints}p`);
    if (entryFee && entryFee > 0) scoringParts.push(`Insats: ${entryFee} kr/p`);
  }

  return (
    <div className="flex flex-col">
      {/* ── Hero strip ── */}
      <section className="relative bg-[#0d1f3c] px-6 py-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="max-w-2xl mx-auto relative flex flex-col gap-5">
          <div className="flex items-center gap-4">
            {league.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={league.bannerUrl}
                alt={league.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shrink-0"
              />
            ) : null}
            <h1 className="text-2xl font-bold text-white tracking-tight">{league.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-xs px-3 py-1.5 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              {members.length} {t("membersLabel", locale)}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/70 text-xs px-3 py-1.5 rounded-full border border-white/10">
              ⚽ VM 2026
            </span>
            {entryFee && entryFee > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-[#e6a800]/15 text-[#e6a800] text-xs px-3 py-1.5 rounded-full border border-[#e6a800]/25 font-medium">
                🏅 Insats {entryFee} kr/p · Pott {entryFee * members.length} kr
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* Live leaderboard */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("navStandings", locale)}</h2>
          <Leaderboard
            leagueId={id}
            currentUserId={dbUser?.id ?? null}
            initial={initialLeaderboard}
          />
        </section>

        {/* Members */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("participantsHeader", locale)}</h2>
            <span className="text-xs text-muted-foreground">{members.length}</span>
          </div>
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
                <span className="text-sm flex-1">
                  {displayLabel(m)}
                  {dbUser && m.userId === dbUser.id && (
                    <span className="ml-2 text-xs text-muted-foreground">{t("youSuffix", locale)}</span>
                  )}
                </span>
                {dbUser && m.userId === dbUser.id && (
                  <ShareTipsButton leagueId={id} inviteUrl={inviteUrl} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Invite */}
        {isMember && (
          <section className="rounded-xl border border-border bg-secondary/30 px-5 py-5 flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("inviteButton", locale)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {locale === "en" ? "Share the link or code with your friends." : "Dela länken eller koden med dina vänner."}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none"
              />
              <CopyButton text={inviteUrl} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{locale === "en" ? "Code:" : "Kod:"}</span>
              <span className="text-sm font-bold font-mono tracking-widest">{league.inviteCode}</span>
            </div>
          </section>
        )}

        {/* Rules */}
        {(features.length > 0 || scoringParts.length > 0) && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("rulesButton", locale)}</h2>
            <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3">
              {features.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {features.map((f) => (
                    <span key={f} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-foreground font-medium">
                      {FEATURE_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              )}
              {scoringParts.length > 0 && (
                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                  {scoringParts.join(" · ")}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Owner settings */}
        {dbUser && league.ownerId === dbUser.id && (
          <section className="flex flex-col gap-2 pt-4 border-t border-border">
            <DeleteLeagueButton leagueId={id} leagueName={league.name} />
          </section>
        )}
      </div>
    </div>
  );
}
