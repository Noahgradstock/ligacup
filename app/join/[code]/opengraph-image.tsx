import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leagues, leagueMembers } from "@/lib/db/schema";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.inviteCode, code.toUpperCase()))
    .limit(1);

  const leagueName = league?.name ?? "VM 2026 tipslag";

  const members = league
    ? await db
        .select({ id: leagueMembers.id })
        .from(leagueMembers)
        .where(eq(leagueMembers.leagueId, league.id))
    : [];

  const memberCount = members.length;
  const memberLabel =
    memberCount === 0
      ? "Var först att gå med!"
      : `${memberCount} ${memberCount === 1 ? "deltagare" : "deltagare"} redan med`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0d1f3c",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: LigaCup wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "white", fontSize: 32, fontWeight: 500 }}>
            Liga
          </span>
          <span style={{ color: "#e6a800", fontSize: 32, fontWeight: 800 }}>
            Cup
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 20,
              marginLeft: 4,
            }}
          >
            · VM 2026
          </span>
        </div>

        {/* Center: league name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            {leagueName}
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 400,
            }}
          >
            {memberLabel}
          </div>
        </div>

        {/* Bottom: CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              background: "#e6a800",
              color: "#0d1f3c",
              fontSize: 26,
              fontWeight: 700,
              padding: "14px 36px",
              borderRadius: 12,
            }}
          >
            Gå med och tippa
          </div>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 22 }}>
            Gratis · Inga insatser
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
