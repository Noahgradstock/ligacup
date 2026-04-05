import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// Deletes duplicate matches keeping only the earliest created row per (homeTeamId, awayTeamId, tournamentId)
export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_session")?.value !== process.env.ADMIN_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Delete duplicates — keep the row with the smallest id (first inserted)
  await db.execute(sql`
    DELETE FROM matches
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM matches
      GROUP BY tournament_id, home_team_id, away_team_id
    )
  `);

  const remaining = await db.select({ count: sql<number>`count(*)` }).from(matches);
  return Response.json({ remainingMatches: Number(remaining[0].count) });
}
