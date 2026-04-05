import "dotenv/config";
import { db } from "../lib/db";
import { matches } from "../lib/db/schema";
import { sql, count } from "drizzle-orm";

async function main() {
  console.log("🧹 Removing duplicate matches...");

  const [{ value: before }] = await db.select({ value: count() }).from(matches);
  console.log(`Before: ${before} matches`);

  await db.execute(sql`
    DELETE FROM matches
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM matches
      GROUP BY tournament_id, home_team_id, away_team_id
    )
  `);

  const [{ value: after }] = await db.select({ value: count() }).from(matches);
  console.log(`After: ${after} matches`);
  console.log("✅ Done!");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
