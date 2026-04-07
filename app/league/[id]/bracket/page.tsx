import { eq, inArray, and, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  matches,
  teams,
  tournamentRounds,
  predictions,
  leagues,
  leagueMembers,
} from "@/lib/db/schema";
import { BracketView } from "@/components/bracket-view";
import { syncCurrentUser } from "@/lib/sync-user";
import { calcPoints } from "@/lib/predictor/points";
import { computeGroupStandings } from "@/lib/predictor/standings";

function toFlag(code: string | null | undefined) {
  if (!code) return "🏳";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function parseVenueSlots(venue: string | null): { homeSlot: string | null; awaySlot: string | null } {
  if (!venue) return { homeSlot: null, awaySlot: null };
  try {
    const parsed = JSON.parse(venue);
    return { homeSlot: parsed.homeSlot ?? null, awaySlot: parsed.awaySlot ?? null };
  } catch {
    return { homeSlot: null, awaySlot: null };
  }
}

function formatSlotLabel(slot: string | null): string {
  if (!slot) return "TBD";
  if (/^[123][A-L]/.test(slot)) {
    const pos = slot[0] === "1" ? "Etta" : slot[0] === "2" ? "Tvåa" : "Trea";
    return `${pos} ${slot.slice(1)}`;
  }
  if (slot.startsWith("VM")) return `V. match ${slot.slice(2)}`;
  if (slot.startsWith("VK")) return `V. kvartsfinal ${slot.slice(2)}`;
  if (slot.startsWith("VS")) return `V. semifinal ${slot.slice(2)}`;
  return slot;
}

const KNOCKOUT_ROUND_TYPES = ["ROUND_OF_32", "ROUND_OF_16", "QF", "SF", "FINAL"];

export default async function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dbUser, league] = await Promise.all([
    syncCurrentUser(),
    db.select().from(leagues).where(eq(leagues.id, id)).limit(1).then((r) => r[0] ?? null),
  ]);

  if (!league) notFound();

  if (dbUser) {
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.leagueId, id),
          eq(leagueMembers.userId, dbUser.id),
          eq(leagueMembers.isActive, true)
        )
      )
      .limit(1);
    if (!membership) notFound();
  }

  // Gate: user must have predicted all group stage matches before accessing bracket
  if (dbUser) {
    const groupMatchIds = await db
      .select({ id: matches.id })
      .from(matches)
      .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
      .where(
        and(
          eq(tournamentRounds.tournamentId, league.tournamentId),
          eq(tournamentRounds.roundType, "GROUP")
        )
      );

    const totalGroupMatches = groupMatchIds.length;

    const [{ value: tippedCount }] = await db
      .select({ value: count() })
      .from(predictions)
      .where(
        and(
          inArray(predictions.matchId, groupMatchIds.map((m) => m.id)),
          eq(predictions.leagueId, id),
          eq(predictions.userId, dbUser.id)
        )
      );

    if (tippedCount < totalGroupMatches) {
      const remaining = totalGroupMatches - tippedCount;
      return (
        <div className="max-w-2xl mx-auto w-full px-4 py-16 flex flex-col items-center gap-6 text-center">
          <div className="text-5xl">🔒</div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Slutspelet är låst</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Du måste tippa alla gruppspelets matcher innan du kan tippa slutspelet.
              {remaining === 1
                ? " Du har 1 match kvar att tippa."
                : ` Du har ${remaining} matcher kvar att tippa.`}
            </p>
          </div>
          <Link
            href={`/league/${id}/predictions`}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Tippa gruppspelets matcher →
          </Link>
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{tippedCount} tippade</span>
              <span>{totalGroupMatches} totalt</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(tippedCount / totalGroupMatches) * 100}%` }}
              />
            </div>
          </div>
        </div>
      );
    }
  }

  // ── Build slot → team name map from user's group predictions ──────────────
  // Maps e.g. "1A" → { name: "Brasilien", flag: "🇧🇷" }
  const slotTeamMap = new Map<string, { name: string; flag: string }>();

  if (dbUser) {
    const homeTeamAlias = alias(teams, "home_team");
    const awayTeamAlias = alias(teams, "away_team");

    const groupRows = await db
      .select({
        matchId: matches.id,
        groupName: matches.groupName,
        homeTeamName: homeTeamAlias.name,
        homeTeamCode: homeTeamAlias.countryCode,
        awayTeamName: awayTeamAlias.name,
        awayTeamCode: awayTeamAlias.countryCode,
        actualHome: matches.homeScore,
        actualAway: matches.awayScore,
        isResultConfirmed: matches.isResultConfirmed,
      })
      .from(matches)
      .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
      .innerJoin(homeTeamAlias, eq(matches.homeTeamId, homeTeamAlias.id))
      .innerJoin(awayTeamAlias, eq(matches.awayTeamId, awayTeamAlias.id))
      .where(
        and(
          eq(matches.tournamentId, league.tournamentId),
          eq(tournamentRounds.roundType, "GROUP")
        )
      );

    // Load user's group predictions
    const groupMatchIds = groupRows.map((r) => r.matchId);
    const groupPreds = groupMatchIds.length > 0
      ? await db
          .select()
          .from(predictions)
          .where(
            and(
              inArray(predictions.matchId, groupMatchIds),
              eq(predictions.leagueId, id),
              eq(predictions.userId, dbUser.id)
            )
          )
      : [];

    const predMap = new Map(
      groupPreds.map((p) => [p.matchId, { home: p.homeScorePred, away: p.awayScorePred }])
    );

    // Group match rows by group name
    const byGroup = new Map<string, typeof groupRows>();
    for (const r of groupRows) {
      if (!r.groupName) continue;
      if (!byGroup.has(r.groupName)) byGroup.set(r.groupName, []);
      byGroup.get(r.groupName)!.push(r);
    }

    // Compute standings per group → populate slot map
    for (const [groupName, gMatches] of byGroup.entries()) {
      const standings = computeGroupStandings(
        gMatches.map((m) => ({
          matchId: m.matchId,
          homeTeam: m.homeTeamName,
          homeFlag: toFlag(m.homeTeamCode),
          awayTeam: m.awayTeamName,
          awayFlag: toFlag(m.awayTeamCode),
          actualHome: m.isResultConfirmed ? m.actualHome : null,
          actualAway: m.isResultConfirmed ? m.actualAway : null,
        })),
        predMap
      );

      if (standings[0]) slotTeamMap.set(`1${groupName}`, standings[0]);
      if (standings[1]) slotTeamMap.set(`2${groupName}`, standings[1]);
      if (standings[2]) slotTeamMap.set(`3${groupName}`, standings[2]);
      if (standings[3]) slotTeamMap.set(`4${groupName}`, standings[3]);
    }

    // DEBUG — ta bort efter felsökning
    console.log("[bracket] groupRows:", groupRows.length, "groupPreds:", groupPreds.length, "slotTeamMap keys:", [...slotTeamMap.keys()]);
  }

  // ── Load knockout rounds and matches ──────────────────────────────────────
  const knockoutRounds = await db
    .select()
    .from(tournamentRounds)
    .where(
      and(
        eq(tournamentRounds.tournamentId, league.tournamentId),
        inArray(tournamentRounds.roundType, KNOCKOUT_ROUND_TYPES)
      )
    )
    .orderBy(tournamentRounds.sequenceOrder);

  if (knockoutRounds.length === 0) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 pt-10 text-center">
        <p className="text-muted-foreground text-sm">Slutspelet har inte seedad ännu.</p>
      </div>
    );
  }

  const roundIds = knockoutRounds.map((r) => r.id);
  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  const rows = await db
    .select({
      match: matches,
      round: tournamentRounds,
      homeTeamName: homeTeam.name,
      homeTeamCode: homeTeam.countryCode,
      awayTeamName: awayTeam.name,
      awayTeamCode: awayTeam.countryCode,
    })
    .from(matches)
    .innerJoin(tournamentRounds, eq(matches.roundId, tournamentRounds.id))
    .leftJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(inArray(matches.roundId, roundIds))
    .orderBy(tournamentRounds.sequenceOrder, matches.matchNumber);

  const predMap = new Map<string, { home: number; away: number }>();
  if (dbUser && rows.length > 0) {
    const matchIds = rows.map((r) => r.match.id);
    const preds = await db
      .select()
      .from(predictions)
      .where(
        and(
          inArray(predictions.matchId, matchIds),
          eq(predictions.leagueId, id),
          eq(predictions.userId, dbUser.id)
        )
      );
    for (const p of preds) {
      predMap.set(p.matchId, { home: p.homeScorePred, away: p.awayScorePred });
    }
  }

  const now = new Date();
  const defaultRules = { pointsExactScore: 3, pointsCorrectWinner: 1, pointsCorrectDraw: 1 };

  const matchData = rows.map(({ match, round, homeTeamName, homeTeamCode, awayTeamName, awayTeamCode }) => {
    const { homeSlot, awaySlot } = parseVenueSlots(match.venue);
    const pred = predMap.get(match.id) ?? null;
    const hasResult = match.isResultConfirmed && match.homeScore !== null && match.awayScore !== null;
    const pointsEarned = hasResult && pred
      ? calcPoints(
          { home: pred.home, away: pred.away },
          { home: match.homeScore!, away: match.awayScore! },
          defaultRules
        )
      : null;

    // Resolve team: DB team (confirmed) > slot from user's group predictions > generic label
    const resolvedHome = homeTeamName
      ? { name: homeTeamName, flag: toFlag(homeTeamCode) }
      : (homeSlot ? (slotTeamMap.get(homeSlot) ?? null) : null);
    const resolvedAway = awayTeamName
      ? { name: awayTeamName, flag: toFlag(awayTeamCode) }
      : (awaySlot ? (slotTeamMap.get(awaySlot) ?? null) : null);

    return {
      matchId: match.id,
      leagueId: id,
      roundType: round.roundType,
      roundName: round.name,
      matchNumber: match.matchNumber ?? 0,
      homeTeam: resolvedHome?.name ?? formatSlotLabel(homeSlot),
      homeFlag: resolvedHome?.flag ?? "🏳",
      awayTeam: resolvedAway?.name ?? formatSlotLabel(awaySlot),
      awayFlag: resolvedAway?.flag ?? "🏳",
      scheduledAt: match.scheduledAt.toISOString(),
      existingHome: pred?.home ?? null,
      existingAway: pred?.away ?? null,
      isLocked: now >= match.scheduledAt,
      actualHome: hasResult ? match.homeScore! : null,
      actualAway: hasResult ? match.awayScore! : null,
      pointsEarned,
      isTbd: (homeTeamName === null && !slotTeamMap.has(homeSlot ?? "")) ||
             (awayTeamName === null && !slotTeamMap.has(awaySlot ?? "")),
    };
  });

  const rounds = knockoutRounds.map((r) => ({
    roundType: r.roundType,
    roundName: r.name,
  }));

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Slutspelet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tippa vem som vinner varje match — lagen baseras på dina grupptips
        </p>
      </div>
      <BracketView matches={matchData} rounds={rounds} leagueId={id} />
    </div>
  );
}
