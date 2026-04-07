/**
 * Seed script — World Cup 2026 data
 * Run: npm run db:seed
 * Run with --reset to wipe existing tournament data and re-seed.
 *
 * Official 48-team format: 12 groups (A–L) of 4 teams each.
 * Groups confirmed from the FIFA Final Draw, December 5 2025.
 */

import "dotenv/config";
import { db } from "../lib/db";
import {
  tournaments,
  tournamentRounds,
  teams,
  matches,
  predictions,
  pointSnapshots,
  predictionRules,
} from "../lib/db/schema";
import { eq, inArray } from "drizzle-orm";

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
    groups: 12,
    total_teams: 48,
    total_matches: 104,
  },
  startsAt: new Date("2026-06-11T20:00:00Z"),
  endsAt: new Date("2026-07-19T20:00:00Z"),
};

// ---------------------------------------------------------------------------
// 48 Teams — official draw result (December 5 2025)
// ---------------------------------------------------------------------------

const TEAMS = [
  // Group A
  { name: "Mexiko",           shortName: "MEX", slug: "mexiko",           countryCode: "MX" },
  { name: "Sydkorea",         shortName: "KOR", slug: "sydkorea",         countryCode: "KR" },
  { name: "Sydafrika",        shortName: "RSA", slug: "sydafrika",        countryCode: "ZA" },
  { name: "Tjeckien",         shortName: "CZE", slug: "tjeckien",         countryCode: "CZ" },
  // Group B
  { name: "Kanada",           shortName: "CAN", slug: "kanada",           countryCode: "CA" },
  { name: "Schweiz",          shortName: "SUI", slug: "schweiz",          countryCode: "CH" },
  { name: "Qatar",            shortName: "QAT", slug: "qatar",            countryCode: "QA" },
  { name: "Bosnien",          shortName: "BIH", slug: "bosnien",          countryCode: "BA" },
  // Group C
  { name: "Brasilien",        shortName: "BRA", slug: "brasilien",        countryCode: "BR" },
  { name: "Marocko",          shortName: "MAR", slug: "marocko",          countryCode: "MA" },
  { name: "Skottland",        shortName: "SCO", slug: "skottland",        countryCode: "GB" },
  { name: "Haiti",            shortName: "HAI", slug: "haiti",            countryCode: "HT" },
  // Group D
  { name: "USA",              shortName: "USA", slug: "usa",              countryCode: "US" },
  { name: "Paraguay",         shortName: "PAR", slug: "paraguay",         countryCode: "PY" },
  { name: "Australien",       shortName: "AUS", slug: "australien",       countryCode: "AU" },
  { name: "Turkiet",          shortName: "TUR", slug: "turkiet",          countryCode: "TR" },
  // Group E
  { name: "Tyskland",         shortName: "GER", slug: "tyskland",         countryCode: "DE" },
  { name: "Ecuador",          shortName: "ECU", slug: "ecuador",          countryCode: "EC" },
  { name: "Elfenbenskusten",  shortName: "CIV", slug: "elfenbenskusten",  countryCode: "CI" },
  { name: "Curaçao",          shortName: "CUW", slug: "curacao",          countryCode: "CW" },
  // Group F
  { name: "Nederländerna",    shortName: "NED", slug: "nederlanderna",    countryCode: "NL" },
  { name: "Japan",            shortName: "JPN", slug: "japan",            countryCode: "JP" },
  { name: "Tunisien",         shortName: "TUN", slug: "tunisien",         countryCode: "TN" },
  { name: "Sverige",          shortName: "SWE", slug: "sverige",          countryCode: "SE" },
  // Group G
  { name: "Belgien",          shortName: "BEL", slug: "belgien",          countryCode: "BE" },
  { name: "Iran",             shortName: "IRN", slug: "iran",             countryCode: "IR" },
  { name: "Egypten",          shortName: "EGY", slug: "egypten",          countryCode: "EG" },
  { name: "Nya Zeeland",      shortName: "NZL", slug: "nya-zeeland",      countryCode: "NZ" },
  // Group H
  { name: "Spanien",          shortName: "ESP", slug: "spanien",          countryCode: "ES" },
  { name: "Uruguay",          shortName: "URU", slug: "uruguay",          countryCode: "UY" },
  { name: "Saudiarabien",     shortName: "KSA", slug: "saudiarabien",     countryCode: "SA" },
  { name: "Kap Verde",        shortName: "CPV", slug: "kap-verde",        countryCode: "CV" },
  // Group I
  { name: "Frankrike",        shortName: "FRA", slug: "frankrike",        countryCode: "FR" },
  { name: "Senegal",          shortName: "SEN", slug: "senegal",          countryCode: "SN" },
  { name: "Norge",            shortName: "NOR", slug: "norge",            countryCode: "NO" },
  { name: "Irak",             shortName: "IRQ", slug: "irak",             countryCode: "IQ" },
  // Group J
  { name: "Argentina",        shortName: "ARG", slug: "argentina",        countryCode: "AR" },
  { name: "Österrike",        shortName: "AUT", slug: "osterrike",        countryCode: "AT" },
  { name: "Algeriet",         shortName: "ALG", slug: "algeriet",         countryCode: "DZ" },
  { name: "Jordanien",        shortName: "JOR", slug: "jordanien",        countryCode: "JO" },
  // Group K
  { name: "Portugal",         shortName: "POR", slug: "portugal",         countryCode: "PT" },
  { name: "Colombia",         shortName: "COL", slug: "colombia",         countryCode: "CO" },
  { name: "Uzbekistan",       shortName: "UZB", slug: "uzbekistan",       countryCode: "UZ" },
  { name: "DR Kongo",         shortName: "COD", slug: "dr-kongo",         countryCode: "CD" },
  // Group L
  { name: "England",          shortName: "ENG", slug: "england",          countryCode: "GB" },
  { name: "Kroatien",         shortName: "CRO", slug: "kroatien",         countryCode: "HR" },
  { name: "Panama",           shortName: "PAN", slug: "panama",           countryCode: "PA" },
  { name: "Ghana",            shortName: "GHA", slug: "ghana",            countryCode: "GH" },
];

// ---------------------------------------------------------------------------
// 12 Groups A–L
// ---------------------------------------------------------------------------

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const GROUP_TEAM_SLUGS: Record<string, [string, string, string, string]> = {
  A: ["mexiko",           "sydkorea",         "sydafrika",      "tjeckien"],
  B: ["kanada",           "schweiz",           "qatar",          "bosnien"],
  C: ["brasilien",        "marocko",           "skottland",      "haiti"],
  D: ["usa",              "paraguay",          "australien",     "turkiet"],
  E: ["tyskland",         "ecuador",           "elfenbenskusten","curacao"],
  F: ["nederlanderna",    "japan",             "tunisien",       "sverige"],
  G: ["belgien",          "iran",              "egypten",        "nya-zeeland"],
  H: ["spanien",          "uruguay",           "saudiarabien",   "kap-verde"],
  I: ["frankrike",        "senegal",           "norge",          "irak"],
  J: ["argentina",        "osterrike",         "algeriet",       "jordanien"],
  K: ["portugal",         "colombia",          "uzbekistan",     "dr-kongo"],
  L: ["england",          "kroatien",          "panama",         "ghana"],
};

// Base start dates — pairs of groups share a day, staggered to cover June 11–22
const GROUP_BASE_DATES: Record<string, string> = {
  A: "2026-06-11", B: "2026-06-12",
  C: "2026-06-11", D: "2026-06-12",
  E: "2026-06-13", F: "2026-06-13",
  G: "2026-06-14", H: "2026-06-14",
  I: "2026-06-15", J: "2026-06-15",
  K: "2026-06-16", L: "2026-06-16",
};

// ---------------------------------------------------------------------------
// Group match generator
// ---------------------------------------------------------------------------

function groupMatches(
  groupName: string,
  teamSlugs: [string, string, string, string],
  roundId: string,
  tournamentId: string,
  baseDate: Date,
  startMatchNumber: number
) {
  // Standard 4-team round-robin: 6 matchups across 3 matchdays
  // Matchday 1: [0v1, 2v3], Matchday 2: [0v2, 1v3], Matchday 3: [0v3, 1v2]
  const pairs: [number, number][] = [
    [0, 1], [2, 3],
    [0, 2], [1, 3],
    [0, 3], [1, 2],
  ];

  return pairs.map(([a, b], i) => {
    const scheduledAt = new Date(baseDate);
    // Each matchday is 3 days apart; 2 matches per matchday at different times
    scheduledAt.setDate(scheduledAt.getDate() + Math.floor(i / 2) * 6);
    scheduledAt.setHours(15 + (i % 2) * 3, 0, 0, 0);

    return {
      tournamentId,
      roundId,
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

  // ── 0. Reset ──────────────────────────────────────────────────────────────
  if (reset) {
    const [existing] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "vm-2026"))
      .limit(1);

    if (existing) {
      // Must delete in FK-safe order: predictions → point_snapshots → matches → rounds
      const existingMatchIds = await db
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.tournamentId, existing.id));

      if (existingMatchIds.length > 0) {
        const ids = existingMatchIds.map((m) => m.id);
        await db.delete(predictions).where(inArray(predictions.matchId, ids));
        console.log("🗑️  Cleared predictions");
      }

      await db.delete(matches).where(eq(matches.tournamentId, existing.id));
      await db.delete(tournamentRounds).where(eq(tournamentRounds.tournamentId, existing.id));
      console.log("🗑️  Cleared matches and rounds");
    }
  }

  // ── 1. Tournament ─────────────────────────────────────────────────────────
  const [tournament] = await db
    .insert(tournaments)
    .values(WC_TOURNAMENT)
    .onConflictDoUpdate({ target: tournaments.slug, set: { name: WC_TOURNAMENT.name, configJson: WC_TOURNAMENT.configJson } })
    .returning();
  console.log(`✅ Tournament: ${tournament.name} (${tournament.id})`);

  // ── 2. Prediction rules ───────────────────────────────────────────────────
  await db
    .insert(predictionRules)
    .values({ tournamentId: tournament.id, pointsExactScore: 3, pointsCorrectWinner: 1, pointsCorrectDraw: 1 })
    .onConflictDoNothing();
  console.log("✅ Prediction rules");

  // ── 3. Teams ──────────────────────────────────────────────────────────────
  const insertedTeams = await db
    .insert(teams)
    .values(TEAMS)
    .onConflictDoUpdate({
      target: teams.slug,
      set: { name: teams.name, shortName: teams.shortName, countryCode: teams.countryCode },
    })
    .returning();
  const teamBySlug = Object.fromEntries(insertedTeams.map((t) => [t.slug, t]));
  console.log(`✅ Teams: ${insertedTeams.length}`);

  // ── 4. Rounds ─────────────────────────────────────────────────────────────
  const existingRounds = await db
    .select()
    .from(tournamentRounds)
    .where(eq(tournamentRounds.tournamentId, tournament.id));

  const existingGroupRounds    = existingRounds.filter((r) => r.roundType === "GROUP");
  const existingKnockoutRounds = existingRounds.filter((r) => r.roundType !== "GROUP");

  // Group rounds (A–L)
  let groupRounds = existingGroupRounds;
  if (existingGroupRounds.length === 0) {
    groupRounds = await db
      .insert(tournamentRounds)
      .values(
        GROUPS.map((g, i) => ({
          tournamentId: tournament.id,
          name: `Grupp ${g}`,
          roundType: "GROUP",
          sequenceOrder: i + 1,
          predictionDeadline: new Date("2026-06-11T19:59:00Z"),
        }))
      )
      .returning();
  }
  const roundByGroup = Object.fromEntries(
    groupRounds.map((r) => [r.name.replace("Grupp ", ""), r])
  );
  console.log(`✅ Group rounds: ${groupRounds.length}`);

  // Knockout rounds
  const knockoutRoundDefs = [
    { name: "Åttondelsfinaler",  roundType: "ROUND_OF_32", sequenceOrder: 13, deadline: new Date("2026-06-27T20:59:00Z") },
    { name: "Sextondelsfinaler", roundType: "ROUND_OF_16", sequenceOrder: 14, deadline: new Date("2026-07-03T20:59:00Z") },
    { name: "Kvartsfinaler",     roundType: "QF",           sequenceOrder: 15, deadline: new Date("2026-07-07T20:59:00Z") },
    { name: "Semifinaler",       roundType: "SF",           sequenceOrder: 16, deadline: new Date("2026-07-11T20:59:00Z") },
    { name: "Final",             roundType: "FINAL",        sequenceOrder: 17, deadline: new Date("2026-07-18T20:59:00Z") },
  ];

  let knockoutRounds = existingKnockoutRounds;
  if (existingKnockoutRounds.length === 0) {
    knockoutRounds = await db
      .insert(tournamentRounds)
      .values(
        knockoutRoundDefs.map((r) => ({
          tournamentId: tournament.id,
          name: r.name,
          roundType: r.roundType,
          sequenceOrder: r.sequenceOrder,
          predictionDeadline: r.deadline,
        }))
      )
      .returning();
  }
  const roundByKnockout = Object.fromEntries(knockoutRounds.map((r) => [r.roundType, r]));
  console.log(`✅ Knockout rounds: ${knockoutRounds.length}`);

  // ── 5. Group stage matches (72 total) ─────────────────────────────────────
  const existingMatches = await db
    .select({ id: matches.id, roundId: matches.roundId })
    .from(matches)
    .where(eq(matches.tournamentId, tournament.id));

  const existingGroupMatchCount = existingMatches.filter((m) =>
    groupRounds.some((r) => r.id === m.roundId)
  ).length;

  if (existingGroupMatchCount === 0) {
    const matchRows = [];
    let matchNumber = 1;

    for (const group of GROUPS) {
      const round    = roundByGroup[group];
      const slugs    = GROUP_TEAM_SLUGS[group];
      const baseDate = new Date(GROUP_BASE_DATES[group] + "T15:00:00Z");

      const raw = groupMatches(group, slugs, round.id, tournament.id, baseDate, matchNumber);
      matchNumber += 6;

      for (const { _homeSlug, _awaySlug, ...rest } of raw) {
        matchRows.push({
          ...rest,
          homeTeamId: teamBySlug[_homeSlug]?.id ?? null,
          awayTeamId: teamBySlug[_awaySlug]?.id ?? null,
        });
      }
    }

    await db.insert(matches).values(matchRows);
    console.log(`✅ Group matches: ${matchRows.length} inserted`);
  } else {
    console.log(`✅ Group matches: ${existingGroupMatchCount} already exist, skipped`);
  }

  // ── 6. Knockout matches ───────────────────────────────────────────────────
  const existingKnockoutMatchCount = existingMatches.filter((m) =>
    knockoutRounds.some((r) => r.id === m.roundId)
  ).length;

  const existingR32Count = existingMatches.filter((m) => {
    const r32 = knockoutRounds.find((r) => r.roundType === "ROUND_OF_32");
    return r32 && m.roundId === r32.id;
  }).length;

  if ((existingKnockoutMatchCount === 0 || existingR32Count < 16) && knockoutRounds.length > 0) {
    // Delete any stale knockout matches first to avoid duplicates
    if (existingKnockoutMatchCount > 0 && existingR32Count < 16) {
      const knockoutMatchIds = existingMatches
        .filter((m) => knockoutRounds.some((r) => r.id === m.roundId))
        .map((m) => m.id);
      if (knockoutMatchIds.length > 0) {
        await db.delete(predictions).where(inArray(predictions.matchId, knockoutMatchIds));
        await db.delete(matches).where(inArray(matches.id, knockoutMatchIds));
        console.log("🗑  Deleted stale knockout matches to rebuild with full 16 R32 matches");
      }
    }
    const r32  = roundByKnockout["ROUND_OF_32"];
    const r16  = roundByKnockout["ROUND_OF_16"];
    const qf   = roundByKnockout["QF"];
    const sf   = roundByKnockout["SF"];
    const fin  = roundByKnockout["FINAL"];

    const knockoutMatchRows = [
      // ── Round of 32 (16 matches) ──
      // Group winners vs runners-up across bracket halves
      { roundId: r32.id, matchNumber: 73,  scheduledAt: new Date("2026-06-28T15:00:00Z"), venue: JSON.stringify({ homeSlot: "1A", awaySlot: "2B" }) },
      { roundId: r32.id, matchNumber: 74,  scheduledAt: new Date("2026-06-28T19:00:00Z"), venue: JSON.stringify({ homeSlot: "1C", awaySlot: "2D" }) },
      { roundId: r32.id, matchNumber: 75,  scheduledAt: new Date("2026-06-29T15:00:00Z"), venue: JSON.stringify({ homeSlot: "1E", awaySlot: "2F" }) },
      { roundId: r32.id, matchNumber: 76,  scheduledAt: new Date("2026-06-29T19:00:00Z"), venue: JSON.stringify({ homeSlot: "1G", awaySlot: "2H" }) },
      { roundId: r32.id, matchNumber: 77,  scheduledAt: new Date("2026-06-30T15:00:00Z"), venue: JSON.stringify({ homeSlot: "1I", awaySlot: "2J" }) },
      { roundId: r32.id, matchNumber: 78,  scheduledAt: new Date("2026-06-30T19:00:00Z"), venue: JSON.stringify({ homeSlot: "1K", awaySlot: "2L" }) },
      { roundId: r32.id, matchNumber: 79,  scheduledAt: new Date("2026-07-01T15:00:00Z"), venue: JSON.stringify({ homeSlot: "1B", awaySlot: "2A" }) },
      { roundId: r32.id, matchNumber: 80,  scheduledAt: new Date("2026-07-01T19:00:00Z"), venue: JSON.stringify({ homeSlot: "1D", awaySlot: "2C" }) },
      { roundId: r32.id, matchNumber: 81,  scheduledAt: new Date("2026-07-02T15:00:00Z"), venue: JSON.stringify({ homeSlot: "1F", awaySlot: "2E" }) },
      { roundId: r32.id, matchNumber: 82,  scheduledAt: new Date("2026-07-02T19:00:00Z"), venue: JSON.stringify({ homeSlot: "1H", awaySlot: "2G" }) },
      { roundId: r32.id, matchNumber: 83,  scheduledAt: new Date("2026-07-03T15:00:00Z"), venue: JSON.stringify({ homeSlot: "1J", awaySlot: "2I" }) },
      { roundId: r32.id, matchNumber: 84,  scheduledAt: new Date("2026-07-03T19:00:00Z"), venue: JSON.stringify({ homeSlot: "1L", awaySlot: "2K" }) },
      // 4 matches involving best 3rd-place teams (slots TBD after group stage)
      { roundId: r32.id, matchNumber: 85,  scheduledAt: new Date("2026-07-04T15:00:00Z"), venue: JSON.stringify({ homeSlot: "3A/B/C", awaySlot: "2L" }) },
      { roundId: r32.id, matchNumber: 86,  scheduledAt: new Date("2026-07-04T19:00:00Z"), venue: JSON.stringify({ homeSlot: "3D/E/F", awaySlot: "2J" }) },
      { roundId: r32.id, matchNumber: 87,  scheduledAt: new Date("2026-07-05T15:00:00Z"), venue: JSON.stringify({ homeSlot: "3G/H/I", awaySlot: "2D" }) },
      { roundId: r32.id, matchNumber: 88,  scheduledAt: new Date("2026-07-05T19:00:00Z"), venue: JSON.stringify({ homeSlot: "3J/K/L", awaySlot: "2B" }) },

      // ── Round of 16 (8 matches) ──
      { roundId: r16.id, matchNumber: 89,  scheduledAt: new Date("2026-07-07T15:00:00Z"), venue: JSON.stringify({ homeSlot: "VM73", awaySlot: "VM74" }) },
      { roundId: r16.id, matchNumber: 90,  scheduledAt: new Date("2026-07-07T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VM75", awaySlot: "VM76" }) },
      { roundId: r16.id, matchNumber: 91,  scheduledAt: new Date("2026-07-08T15:00:00Z"), venue: JSON.stringify({ homeSlot: "VM77", awaySlot: "VM78" }) },
      { roundId: r16.id, matchNumber: 92,  scheduledAt: new Date("2026-07-08T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VM79", awaySlot: "VM80" }) },
      { roundId: r16.id, matchNumber: 93,  scheduledAt: new Date("2026-07-09T15:00:00Z"), venue: JSON.stringify({ homeSlot: "VM81", awaySlot: "VM82" }) },
      { roundId: r16.id, matchNumber: 94,  scheduledAt: new Date("2026-07-09T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VM83", awaySlot: "VM84" }) },
      { roundId: r16.id, matchNumber: 95,  scheduledAt: new Date("2026-07-10T15:00:00Z"), venue: JSON.stringify({ homeSlot: "VM85", awaySlot: "VM86" }) },
      { roundId: r16.id, matchNumber: 96,  scheduledAt: new Date("2026-07-10T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VM87", awaySlot: "VM88" }) },

      // ── Quarter-finals (4 matches) ──
      { roundId: qf.id,  matchNumber: 97,  scheduledAt: new Date("2026-07-12T15:00:00Z"), venue: JSON.stringify({ homeSlot: "VM89", awaySlot: "VM90" }) },
      { roundId: qf.id,  matchNumber: 98,  scheduledAt: new Date("2026-07-12T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VM91", awaySlot: "VM92" }) },
      { roundId: qf.id,  matchNumber: 99,  scheduledAt: new Date("2026-07-13T15:00:00Z"), venue: JSON.stringify({ homeSlot: "VM93", awaySlot: "VM94" }) },
      { roundId: qf.id,  matchNumber: 100, scheduledAt: new Date("2026-07-13T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VM95", awaySlot: "VM96" }) },

      // ── Semi-finals (2 matches) ──
      { roundId: sf.id,  matchNumber: 101, scheduledAt: new Date("2026-07-16T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VK97",  awaySlot: "VK98"  }) },
      { roundId: sf.id,  matchNumber: 102, scheduledAt: new Date("2026-07-17T19:00:00Z"), venue: JSON.stringify({ homeSlot: "VK99",  awaySlot: "VK100" }) },

      // ── Final ──
      { roundId: fin.id, matchNumber: 103, scheduledAt: new Date("2026-07-19T18:00:00Z"), venue: JSON.stringify({ homeSlot: "VS101", awaySlot: "VS102" }) },
    ];

    await db.insert(matches).values(
      knockoutMatchRows.map((m) => ({
        tournamentId: tournament.id,
        roundId: m.roundId,
        matchNumber: m.matchNumber,
        scheduledAt: m.scheduledAt,
        status: "scheduled" as const,
        venue: m.venue,
        homeTeamId: null,
        awayTeamId: null,
      }))
    );
    console.log(`✅ Knockout matches: ${knockoutMatchRows.length} inserted`);
  } else {
    console.log(`✅ Knockout matches: ${existingKnockoutMatchCount} already exist, skipped`);
  }

  console.log("\n🎉 Seed complete!");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
