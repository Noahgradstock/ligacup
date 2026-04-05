import "dotenv/config";
import { db } from "../lib/db";
import { matches } from "../lib/db/schema";
import { sql, count } from "drizzle-orm";

async function main() {
  console.log("🧹 Removing duplicate matches...");

  const [{ value: before }] = await db.select({ value: count() }).from(matches);
  console.log(`Before: ${before} matches`);

  // First delete predictions that reference duplicate matches
  await db.execute(sql`
    DELETE FROM predictions
    WHERE match_id NOT IN (
      SELECT DISTINCT ON (tournament_id, home_team_id, away_team_id) id
      FROM matches
      ORDER BY tournament_id, home_team_id, away_team_id, created_at ASC
    )
  `);

  // Then delete the duplicate matches
  await db.execute(sql`
    DELETE FROM matches
    WHERE id NOT IN (
      SELECT DISTINCT ON (tournament_id, home_team_id, away_team_id) id
      FROM matches
      ORDER BY tournament_id, home_team_id, away_team_id, created_at ASC
    )
  `);

  const [{ value: after }] = await db.select({ value: count() }).from(matches);
  console.log(`After: ${after} matches`);
  console.log("✅ Done!");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
