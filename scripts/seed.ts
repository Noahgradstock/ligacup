/**
 * Seed script — World Cup 2026 data
 * Run: npm run db:seed
 *
 * Seeds: 1 tournament, 8 groups (rounds), 32 teams, 48 group stage matches, 1 prediction rule
 */

import "dotenv/config";
import { db } from "../lib/db";
import { tournaments, tournamentRounds, teams, matches, predictionRules } from "../lib/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

const WC_TOURNAMENT = {
  name: "VM 2026",
  slug: "vm-2026",
  type: "WORLD_CUP",
  season: "2026",
  status: "upcoming",
  configJson: {
    has_group_stage: true,
    has_knockout: true,
    group_size: 4,
    teams_advance_per_group: 2,
    total_teams: 32,
    total_matches: 64,
  },
  startsAt: new Date("2026-06-11T18:00:00Z"),
  endsAt: new Date("2026-07-19T20:00:00Z"),
};

// ---------------------------------------------------------------------------
// Teams (32 qualified — using confirmed + likely qualifiers as of early 2026)
// ---------------------------------------------------------------------------

const TEAMS = [
  // Group A
  { name: "USA", shortName: "USA", slug: "usa", countryCode: "US" },
  { name: "Kanada", shortName: "CAN", slug: "kanada", countryCode: "CA" },
  { name: "Mexico", shortName: "MEX", slug: "mexico", countryCode: "MX" },
  { name: "Panama", shortName: "PAN", slug: "panama", countryCode: "PA" },
  // Group B
  { name: "Argentina", shortName: "ARG", slug: "argentina", countryCode: "AR" },
  { name: "Australien", shortName: "AUS", slug: "australien", countryCode: "AU" },
  { name: "Marocko", shortName: "MAR", slug: "marocko", countryCode: "MA" },
  { name: "Irak", shortName: "IRQ", slug: "irak", countryCode: "IQ" },
  // Group C
  { name: "Frankrike", shortName: "FRA", slug: "frankrike", countryCode: "FR" },
  { name: "Nigeria", shortName: "NGA", slug: "nigeria", countryCode: "NG" },
  { name: "Colombia", shortName: "COL", slug: "colombia", countryCode: "CO" },
  { name: "Japan", shortName: "JPN", slug: "japan", countryCode: "JP" },
  // Group D
  { name: "Brasilien", shortName: "BRA", slug: "brasilien", countryCode: "BR" },
  { name: "Portugal", shortName: "POR", slug: "portugal", countryCode: "PT" },
  { name: "Senegal", shortName: "SEN", slug: "senegal", countryCode: "SN" },
  { name: "Nya Zeeland", shortName: "NZL", slug: "nya-zeeland", countryCode: "NZ" },
  // Group E
  { name: "Spanien", shortName: "ESP", slug: "spanien", countryCode: "ES" },
  { name: "England", shortName: "ENG", slug: "england", countryCode: "GB" },
  { name: "Sydkorea", shortName: "KOR", slug: "sydkorea", countryCode: "KR" },
  { name: "Saudiarabien", shortName: "KSA", slug: "saudiarabien", countryCode: "SA" },
  // Group F
  { name: "Belgien", shortName: "BEL", slug: "belgien", countryCode: "BE" },
  { name: "Kroatien", shortName: "CRO", slug: "kroatien", countryCode: "HR" },
  { name: "Egypten", shortName: "EGY", slug: "egypten", countryCode: "EG" },
  { name: "Ecuador", shortName: "ECU", slug: "ecuador", countryCode: "EC" },
  // Group G
  { name: "Nederländerna", shortName: "NED", slug: "nederlanderna", countryCode: "NL" },
  { name: "Uruguay", shortName: "URU", slug: "uruguay", countryCode: "UY" },
  { name: "Kenya", shortName: "KEN", slug: "kenya", countryCode: "KE" },
  { name: "Uzbekistan", shortName: "UZB", slug: "uzbekistan", countryCode: "UZ" },
  // Group H
  { name: "Tyskland", shortName: "GER", slug: "tyskland", countryCode: "DE" },
  { name: "Sverige", shortName: "SWE", slug: "sverige", countryCode: "SE" },
  { name: "Iran", shortName: "IRN", slug: "iran", countryCode: "IR" },
  { name: "Tunisien", shortName: "TUN", slug: "tunisien", countryCode: "TN" },
];

// ---------------------------------------------------------------------------
// Group stage rounds (one per group, A–H)
// ---------------------------------------------------------------------------

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// ---------------------------------------------------------------------------
// Group stage matches
// Each group has 4 teams → 6 matches (round-robin)
// Seeded with approximate WC 2026 schedule times
// ---------------------------------------------------------------------------

function groupMatches(
  groupName: string,
  teamSlugs: [string, string, string, string],
  roundId: string,
  tournamentId: string,
  baseDate: Date,
  startMatchNumber: number
) {
  // 6 matchups in a 4-team group
  const pairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ];

  return pairs.map(([a, b], i) => {
    const scheduledAt = new Date(baseDate);
    scheduledAt.setDate(scheduledAt.getDate() + Math.floor(i / 2) * 3);
    scheduledAt.setHours(scheduledAt.getHours() + (i % 2) * 3);

    return {
      tournamentId,
      roundId,
      // homeTeamId and awayTeamId will be set after teams are inserted
      _homeSlug: teamSlugs[a],
      _awaySlug: teamSlugs[b],
      scheduledAt,
      status: "scheduled" as const,
      groupName,
      matchNumber: startMatchNumber + i,
    };
  });
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  const reset = process.argv.includes("--reset");
  console.log(`🌱 Seeding World Cup 2026 data...${reset ? " (RESET MODE)" : ""}`);

  // 0. Reset — wipe matches and rounds for a clean re-seed
  if (reset) {
    const [existing] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "vm-2026"))
      .limit(1);
    if (existing) {
      await db.delete(matches).where(eq(matches.tournamentId, existing.id));
      await db.delete(tournamentRounds).where(eq(tournamentRounds.tournamentId, existing.id));
      console.log("🗑️  Cleared existing matches and rounds");
    }
  }

  // 1. Tournament
  const [tournament] = await db
    .insert(tournaments)
    .values(WC_TOURNAMENT)
    .onConflictDoUpdate({ target: tournaments.slug, set: { name: WC_TOURNAMENT.name } })
    .returning();
  console.log(`✅ Tournament: ${tournament.name} (${tournament.id})`);

  // 2. Prediction rules
  await db
    .insert(predictionRules)
    .values({
      tournamentId: tournament.id,
      pointsExactScore: 3,
      pointsCorrectWinner: 1,
      pointsCorrectDraw: 1,
    })
    .onConflictDoNothing();
  console.log("✅ Prediction rules");

  // 3. Teams
  const insertedTeams = await db
    .insert(teams)
    .values(TEAMS)
    .onConflictDoUpdate({ target: teams.slug, set: { name: teams.name } })
    .returning();
  const teamBySlug = Object.fromEntries(insertedTeams.map((t) => [t.slug, t]));
  console.log(`✅ Teams: ${insertedTeams.length}`);

  // 4. Rounds (one per group) — skip if already seeded for this tournament
  const existingRounds = await db
    .select()
    .from(tournamentRounds)
    .where(eq(tournamentRounds.tournamentId, tournament.id));

  const groupTeamSlugs: Record<string, [string, string, string, string]> = {
    A: ["usa", "kanada", "mexico", "panama"],
    B: ["argentina", "australien", "marocko", "irak"],
    C: ["frankrike", "nigeria", "colombia", "japan"],
    D: ["brasilien", "portugal", "senegal", "nya-zeeland"],
    E: ["spanien", "england", "sydkorea", "saudiarabien"],
    F: ["belgien", "kroatien", "egypten", "ecuador"],
    G: ["nederlanderna", "uruguay", "kenya", "uzbekistan"],
    H: ["tyskland", "sverige", "iran", "tunisien"],
  };

  let allRounds = existingRounds;
  if (existingRounds.length === 0) {
    allRounds = await db
      .insert(tournamentRounds)
      .values(
        GROUPS.map((g, i) => ({
          tournamentId: tournament.id,
          name: `Grupp ${g}`,
          roundType: "GROUP",
          sequenceOrder: i + 1,
          predictionDeadline: new Date("2026-06-11T17:59:00Z"),
        }))
      )
      .returning();
  }
  const roundByGroup = Object.fromEntries(
    allRounds.map((r) => [r.name.replace("Grupp ", ""), r])
  );
  console.log(`✅ Rounds: ${allRounds.length} (${existingRounds.length > 0 ? "already existed" : "inserted"})`);

  // 5. Matches
  const baseDate = new Date("2026-06-12T15:00:00Z");
  let matchNumber = 1;
  const matchRows = [];

  for (const group of GROUPS) {
    const round = roundByGroup[group];
    const slugs = groupTeamSlugs[group];
    const groupBase = new Date(baseDate);
    groupBase.setDate(groupBase.getDate() + GROUPS.indexOf(group) % 4);

    const raw = groupMatches(group, slugs, round.id, tournament.id, groupBase, matchNumber);
    matchNumber += 6;

    for (const m of raw) {
      const { _homeSlug, _awaySlug, ...rest } = m;
      matchRows.push({
        ...rest,
        homeTeamId: teamBySlug[_homeSlug]?.id ?? null,
        awayTeamId: teamBySlug[_awaySlug]?.id ?? null,
      });
    }
  }

  const existingMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.tournamentId, tournament.id));

  if (existingMatches.length === 0) {
    await db.insert(matches).values(matchRows);
    console.log(`✅ Matches: ${matchRows.length} group stage matches inserted`);
  } else {
    console.log(`✅ Matches: ${existingMatches.length} already exist, skipped`);
  }
  console.log("\n🎉 Seed complete!");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
