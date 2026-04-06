import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { leagues, leagueMembers } from "@/lib/db/schema";
import { redis, keys } from "@/lib/redis";
import { ChatRoom } from "@/components/chat-room";
import { syncCurrentUser } from "@/lib/sync-user";
import type { ChatMessage } from "@/app/api/leagues/[id]/messages/route";

export default async function LeagueChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [league, user] = await Promise.all([
    db.select().from(leagues).where(eq(leagues.id, id)).limit(1).then((r) => r[0] ?? null),
    syncCurrentUser(),
  ]);

  if (!league) notFound();
  if (!user) redirect("/sign-in");

  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, id), eq(leagueMembers.userId, user.id), eq(leagueMembers.isActive, true)))
    .limit(1);
  if (!membership) redirect(`/join/${league.inviteCode}`);

  let initial: ChatMessage[] = [];
  try {
    const raw = await redis.lrange(keys.messages(id), 0, 99);
    if (raw.length > 0) {
      initial = raw.map((r) => JSON.parse(r) as ChatMessage).reverse();
    }
  } catch {
    // Redis unavailable
  }

  // Chat needs to fill remaining vertical space — use flex-1 within the layout's flex column
  return <ChatRoom leagueId={id} currentUserId={user.id} initial={initial} />;
}
