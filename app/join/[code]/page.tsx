import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { leagues, leagueMembers } from "@/lib/db/schema";
import { JoinButton } from "./join-button";
import { AppNav } from "@/components/app-nav";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.inviteCode, code.toUpperCase()))
    .limit(1);

  if (!league) return {};

  const members = await db
    .select({ id: leagueMembers.id })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, league.id));

  const memberCount = members.length;
  const title = `${league.name} — VM 2026 tipslag`;
  const description =
    memberCount === 0
      ? "Bli första att gå med! Tippa alla VM-matcher och tävla om äran."
      : `${memberCount} ${memberCount === 1 ? "deltagare har" : "deltagare har"} redan gått med. Kan du slå dem?`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Ligacup.se",
      locale: "sv_SE",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const upperCode = code.toUpperCase();

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.inviteCode, upperCode))
    .limit(1);

  if (!league || league.status !== "active") notFound();

  const members = await db
    .select({ id: leagueMembers.id })
    .from(leagueMembers)
    .where(eq(leagueMembers.leagueId, league.id));

  return (
    <main className="flex flex-col min-h-screen">
      <AppNav backHref="/dashboard" hideNav />

      <div className="max-w-md mx-auto w-full px-6 py-16 flex flex-col gap-8 text-center">
        <div className="flex flex-col gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mx-auto">
            ⚽
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{league.name}</h1>
          <p className="text-muted-foreground text-sm">
            {members.length} {members.length === 1 ? "deltagare" : "deltagare"} · VM 2026
          </p>
        </div>

        <JoinButton code={upperCode} leagueId={league.id} />

        <p className="text-xs text-muted-foreground">
          Inbjudningskod: <span className="font-mono font-semibold">{upperCode}</span>
        </p>
      </div>
    </main>
  );
}
