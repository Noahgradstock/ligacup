import "dotenv/config";
import { db } from "../lib/db";
import { matches } from "../lib/db/schema";
import { sql, count } from "drizzle-orm";

async function main() {
  console.log("🧹 Removing duplicate matches...");

  const [{ value: before }] = await db.select({ value: count() }).from(matches);
  console.log(`Before: ${before} matches`);

  // Only deduplicate group-stage matches (those with real team IDs).
  // Knockout matches have homeTeamId/awayTeamId = NULL and must NOT be touched —
  // DISTINCT ON would collapse all NULL-NULL rows into one and delete the rest,
  // which would orphan and destroy all knockout predictions.
  await db.execute(sql`
    DELETE FROM predictions
    WHERE match_id IN (
      SELECT id FROM matches WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
    )
    AND match_id NOT IN (
      SELECT DISTINCT ON (tournament_id, home_team_id, away_team_id) id
      FROM matches
      WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
      ORDER BY tournament_id, home_team_id, away_team_id, created_at ASC
    )
  `);

  // Then delete the duplicate group-stage matches (never touch knockout rows)
  await db.execute(sql`
    DELETE FROM matches
    WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
    AND id NOT IN (
      SELECT DISTINCT ON (tournament_id, home_team_id, away_team_id) id
      FROM matches
      WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
      ORDER BY tournament_id, home_team_id, away_team_id, created_at ASC
    )
  `);

  const [{ value: after }] = await db.select({ value: count() }).from(matches);
  console.log(`After: ${after} matches`);
  console.log("✅ Done!");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
