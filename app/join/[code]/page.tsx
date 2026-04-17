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

  const bannerUrl = league.bannerUrl;

  return (
    <main className="flex flex-col min-h-screen">
      <AppNav backHref="/dashboard" hideNav />

      {/* Hero */}
      <section className="relative bg-[#0d1f3c] overflow-hidden">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Banner image overlay */}
        {bannerUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bannerUrl})` }}
          >
            <div className="absolute inset-0 bg-[#0d1f3c]/70" />
          </div>
        )}

        <div className="relative max-w-lg mx-auto px-6 py-10 flex flex-col gap-2">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">
            VM 2026 tipslag
          </p>
          <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
            {league.name}
          </h1>
          <p className="text-white/55 text-sm mt-1">
            {members.length === 0
              ? "Var först att gå med!"
              : `${members.length} ${members.length === 1 ? "deltagare" : "deltagare"} redan med`}
          </p>
        </div>
      </section>

      {/* Join card */}
      <div className="max-w-lg mx-auto w-full px-6 py-10 flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Gå med och tippa</h2>
            <p className="text-sm text-muted-foreground">
              Förutsäg alla VM-matcher och slutspelet. Gratis — inga insatser, bara äran.
            </p>
          </div>

          <JoinButton code={upperCode} leagueId={league.id} />

          <p className="text-xs text-muted-foreground text-center">
            Inbjudningskod: <span className="font-mono font-semibold">{upperCode}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
