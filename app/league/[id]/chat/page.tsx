import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { leagues, leagueMembers } from "@/lib/db/schema";
import { redis, keys } from "@/lib/redis";
import { AppNav } from "@/components/app-nav";
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

  // Must be a member
  const [membership] = await db
    .select()
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, id), eq(leagueMembers.userId, user.id), eq(leagueMembers.isActive, true)))
    .limit(1);
  if (!membership) redirect(`/join/${league.inviteCode}`);

  // Initial messages from Redis (newest first in list → reverse for chronological)
  let initial: ChatMessage[] = [];
  try {
    const raw = await redis.lrange(keys.messages(id), 0, 99);
    if (raw.length > 0) {
      initial = raw.map((r) => JSON.parse(r) as ChatMessage).reverse();
    }
  } catch {
    // Redis unavailable — ChatRoom will show empty, messages load on send
  }

  return (
    <main className="flex flex-col h-screen">
      <AppNav
        rightSlot={
          <Link href={`/league/${id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Tabell
          </Link>
        }
      />

      {/* League name + tab bar */}
      <div className="border-b border-border px-6 pt-3 flex flex-col gap-2">
        <p className="text-sm font-semibold">{league.name}</p>
        <div className="flex gap-4 text-sm">
          <Link href={`/league/${id}`} className="pb-2 text-muted-foreground hover:text-foreground transition-colors">
            Tabell
          </Link>
          <span className="pb-2 border-b-2 border-primary text-foreground font-medium">
            Chatt
          </span>
        </div>
      </div>

      <ChatRoom leagueId={id} currentUserId={user.id} initial={initial} />
    </main>
  );
}
