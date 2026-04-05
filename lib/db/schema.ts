import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  char,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(), // WORLD_CUP | LEAGUE | KNOCKOUT | MIXED
  season: text("season").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming | active | completed
  configJson: jsonb("config_json").notNull().default({}),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tournamentRounds = pgTable("tournament_rounds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  name: text("name").notNull(),
  roundType: text("round_type").notNull(), // GROUP | ROUND_OF_16 | QF | SF | FINAL | REGULAR
  sequenceOrder: integer("sequence_order").notNull(),
  predictionDeadline: timestamp("prediction_deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Teams & Matches
// ---------------------------------------------------------------------------

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shortName: text("short_name"),
  slug: text("slug").notNull().unique(),
  countryCode: char("country_code", { length: 2 }),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
    roundId: uuid("round_id").notNull().references(() => tournamentRounds.id),
    homeTeamId: uuid("home_team_id").references(() => teams.id),
    awayTeamId: uuid("away_team_id").references(() => teams.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled | live | completed | postponed
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    isResultConfirmed: boolean("is_result_confirmed").notNull().default(false),
    venue: text("venue"),
    groupName: text("group_name"),
    matchNumber: integer("match_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("matches_tournament_scheduled_idx").on(t.tournamentId, t.scheduledAt),
    index("matches_round_idx").on(t.roundId),
    index("matches_unconfirmed_idx").on(t.isResultConfirmed),
  ]
);

export const predictionRules = pgTable("prediction_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  pointsExactScore: integer("points_exact_score").notNull().default(3),
  pointsCorrectWinner: integer("points_correct_winner").notNull().default(1),
  pointsCorrectDraw: integer("points_correct_draw").notNull().default(1),
  bonusUnderdogMultiplier: numeric("bonus_underdog_multiplier", { precision: 3, scale: 1 }).default("1.0"),
  appliesToRoundType: text("applies_to_round_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  username: text("username").unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  subscriptionTier: text("subscription_tier").notNull().default("free"), // free | pro | team
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  inviteCode: char("invite_code", { length: 8 }).notNull().unique(),
  maxMembers: integer("max_members").notNull().default(20),
  isPublic: boolean("is_public").notNull().default(false),
  bannerUrl: text("banner_url"),
  configJson: jsonb("config_json").notNull().default({}),
  status: text("status").notNull().default("active"), // active | completed | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leagueMembers = pgTable(
  "league_members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    leagueId: uuid("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    customAlias: text("custom_alias"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("league_members_unique_idx").on(t.leagueId, t.userId),
    index("league_members_user_idx").on(t.userId),
    index("league_members_league_idx").on(t.leagueId),
  ]
);

// ---------------------------------------------------------------------------
// Predictions & Scoring
// ---------------------------------------------------------------------------

export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id),
    matchId: uuid("match_id").notNull().references(() => matches.id),
    leagueId: uuid("league_id").references(() => leagues.id, { onDelete: "cascade" }),
    homeScorePred: integer("home_score_pred").notNull(),
    awayScorePred: integer("away_score_pred").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("predictions_user_match_league_idx").on(t.userId, t.matchId, t.leagueId),
    index("predictions_user_idx").on(t.userId),
    index("predictions_match_idx").on(t.matchId),
    index("predictions_league_idx").on(t.leagueId),
  ]
);

export const pointSnapshots = pgTable(
  "point_snapshots",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id),
    leagueId: uuid("league_id").notNull().references(() => leagues.id),
    tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
    totalPoints: integer("total_points").notNull().default(0),
    rankInLeague: integer("rank_in_league"),
    matchesPlayed: integer("matches_played").notNull().default(0),
    exactScores: integer("exact_scores").notNull().default(0),
    correctWinners: integer("correct_winners").notNull().default(0),
    lastMatchId: uuid("last_match_id").references(() => matches.id),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("point_snapshots_user_league_idx").on(t.userId, t.leagueId),
    index("point_snapshots_league_idx").on(t.leagueId, t.totalPoints),
  ]
);

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    leagueId: uuid("league_id").notNull().references(() => leagues.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    text: text("text").notNull(),
    mentions: uuid("mentions").array().notNull().default(sql`'{}'::uuid[]`),
    replyTo: uuid("reply_to"),
    reactions: jsonb("reactions").notNull().default({}),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_league_created_idx").on(t.leagueId, t.createdAt),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: text("type").notNull(), // rank_overtaken | mention | league_invite | match_starting
    payload: jsonb("payload").notNull().default({}),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_unread_idx").on(t.userId, t.isRead),
  ]
);

export const punishments = pgTable("punishments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: uuid("league_id").notNull().references(() => leagues.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  punishmentText: text("punishment_text").notNull(),
  witnessIds: uuid("witness_ids").array().notNull().default(sql`'{}'::uuid[]`),
  status: text("status").notNull().default("pending"), // pending | confirmed | disputed
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Types (inferred from schema)
// ---------------------------------------------------------------------------

export type Tournament = typeof tournaments.$inferSelect;
export type TournamentRound = typeof tournamentRounds.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type User = typeof users.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type LeagueMember = typeof leagueMembers.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type PointSnapshot = typeof pointSnapshots.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Punishment = typeof punishments.$inferSelect;
