import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { leagues } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { BottomNav } from "@/components/bottom-nav";
import { LeagueSubNav } from "@/components/league-sub-nav";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const league = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!league) notFound();

  return (
    <div className="flex flex-col min-h-screen pb-20 sm:pb-0">
      <AppNav backHref="/dashboard" backLabel="Dashboard" />
      <LeagueSubNav leagueId={id} leagueName={league.name} />
      <div className="flex-1 flex flex-col">{children}</div>
      <BottomNav />
    </div>
  );
}
