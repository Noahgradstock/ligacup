import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leagues, leagueMembers, pointSnapshots, messages, notifications, punishments } from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await syncCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) return new Response("Not found", { status: 404 });
  if (league.ownerId !== user.id) return new Response("Forbidden", { status: 403 });

  // Delete in dependency order to avoid FK violations
  await db.delete(punishments).where(eq(punishments.leagueId, id));
  await db.delete(messages).where(eq(messages.leagueId, id));
  await db.delete(pointSnapshots).where(eq(pointSnapshots.leagueId, id));
  await db.delete(leagueMembers).where(eq(leagueMembers.leagueId, id));
  await db.delete(leagues).where(eq(leagues.id, id));

  return new Response(null, { status: 204 });
}
