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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <section className="relative bg-[#0d1f3c] px-6 py-6 overflow-hidden shrink-0">
        <div className="pointer-events-none absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="max-w-2xl mx-auto relative flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-white tracking-tight">Chatt</h1>
          <p className="text-white/55 text-sm">Prata med laget i realtid.</p>
        </div>
      </section>
      <ChatRoom leagueId={id} currentUserId={user.id} initial={initial} />
    </div>
  );
}
