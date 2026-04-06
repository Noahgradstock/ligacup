import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, teams } from "@/lib/db/schema";
import { cookies } from "next/headers";

async function isAuthorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get("admin_session")?.value === process.env.ADMIN_SECRET;
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { matchId: string; homeTeamId: string; awayTeamId: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { matchId, homeTeamId, awayTeamId } = body;
  if (
    typeof matchId !== "string" ||
    typeof homeTeamId !== "string" ||
    typeof awayTeamId !== "string" ||
    homeTeamId === awayTeamId
  ) {
    return new Response("Invalid input", { status: 400 });
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return new Response("Match not found", { status: 404 });

  const [home, away] = await Promise.all([
    db.select().from(teams).where(eq(teams.id, homeTeamId)).limit(1),
    db.select().from(teams).where(eq(teams.id, awayTeamId)).limit(1),
  ]);
  if (!home[0] || !away[0]) return new Response("Team not found", { status: 404 });

  await db
    .update(matches)
    .set({ homeTeamId, awayTeamId, updatedAt: new Date() })
    .where(eq(matches.id, matchId));

  return Response.json({ ok: true, home: home[0].name, away: away[0].name });
}
