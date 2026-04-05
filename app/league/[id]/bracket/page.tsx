import { eq, inArray, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  matches,
  teams,
  tournamentRounds,
  predictions,
  leagues,
  leagueMembers,
} from "@/lib/db/schema";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { BracketView } from "@/components/bracket-view";
import { Button } from "@/components/ui/button";
import { syncCurrentUser } from "@/lib/sync-user";
import { calcPoints } from "@/lib/predictor/points";

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
  // "1A" → "1:a A", "2B" → "2:a B"
  if (/^[12][A-H]$/.test(slot)) {
    return `${slot[0]}:a ${slot[1]}`;
  }
  // "VM49" → "Vinnare M49" (Vinnare Match)
  if (slot.startsWith("VM")) return `V. match ${slot.slice(2)}`;
  // "VK57" → "Vinnare K57" (Vinnare Kvartsfinal)
  if (slot.startsWith("VK")) return `V. kvart ${slot.slice(2)}`;
  // "VS61" → "Vinnare S61" (Vinnare Semifinal)
  if (slot.startsWith("VS")) return `V. semi ${slot.slice(2)}`;
  return slot;
}

const KNOCKOUT_ROUND_TYPES = ["ROUND_OF_16", "QF", "SF", "FINAL"];

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

  const homeTeam = alias(teams, "home_team");
  const awayTeam = alias(teams, "away_team");

  // Query all knockout rounds for this tournament
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
      <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
        <AppNav
          backHref={`/league/${id}`}
          backLabel={league.name}
          rightSlot={
            <Link href={`/league/${id}/predictions`}>
              <Button variant="outline" size="sm">⚽ Grupptips</Button>
            </Link>
          }
        />
        <div className="max-w-2xl mx-auto w-full px-4 pt-10">
          <p className="text-muted-foreground text-sm text-center">
            Slutspelet har inte seedad ännu.
          </p>
        </div>
        <BottomNav />
      </main>
    );
  }

  const roundIds = knockoutRounds.map((r) => r.id);

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

  // Load user's predictions for bracket matches
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

    return {
      matchId: match.id,
      leagueId: id,
      roundType: round.roundType,
      roundName: round.name,
      matchNumber: match.matchNumber ?? 0,
      homeTeam: homeTeamName ?? formatSlotLabel(homeSlot),
      homeFlag: toFlag(homeTeamCode),
      awayTeam: awayTeamName ?? formatSlotLabel(awaySlot),
      awayFlag: toFlag(awayTeamCode),
      scheduledAt: match.scheduledAt.toISOString(),
      existingHome: pred?.home ?? null,
      existingAway: pred?.away ?? null,
      isLocked: now >= match.scheduledAt,
      actualHome: hasResult ? match.homeScore! : null,
      actualAway: hasResult ? match.awayScore! : null,
      pointsEarned,
      isTbd: homeTeamName === null || awayTeamName === null,
    };
  });

  const rounds = knockoutRounds.map((r) => ({
    roundType: r.roundType,
    roundName: r.name,
  }));

  return (
    <main className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav
        backHref={`/league/${id}`}
        backLabel={league.name}
        rightSlot={
          <Link href={`/league/${id}/predictions`}>
            <Button variant="outline" size="sm">⚽ Grupptips</Button>
          </Link>
        }
      />

      <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-4 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slutspelet</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {league.name} · Tippa vem som vinner varje match
          </p>
        </div>

        <BracketView matches={matchData} rounds={rounds} leagueId={id} />
      </div>

      <BottomNav />
    </main>
  );
}
