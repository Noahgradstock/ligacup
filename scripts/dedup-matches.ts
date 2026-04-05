import "dotenv/config";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🧹 Removing duplicate matches...");

  const before = await db.execute(sql`SELECT COUNT(*) as count FROM matches`);
  console.log(`Before: ${(before.rows[0] as { count: string }).count} matches`);

  await db.execute(sql`
    DELETE FROM matches
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM matches
      GROUP BY tournament_id, home_team_id, away_team_id
    )
  `);

  const after = await db.execute(sql`SELECT COUNT(*) as count FROM matches`);
  console.log(`After: ${(after.rows[0] as { count: string }).count} matches`);
  console.log("✅ Done!");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
