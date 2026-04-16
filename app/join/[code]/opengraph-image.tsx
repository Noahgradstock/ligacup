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

  const bannerUrl = league?.bannerUrl ?? null;
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

  // No banner — show simple logo-only card
  if (!bannerUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#0d1f3c",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "white", fontSize: 72, fontWeight: 500 }}>Liga</span>
            <span style={{ color: "#e6a800", fontSize: 72, fontWeight: 800 }}>Cup</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 28 }}>
            VM 2026 tipslag
          </span>
        </div>
      ),
      { ...size }
    );
  }

  // Has banner — show it as background with overlay and league info
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0d1f3c",
          fontFamily: "sans-serif",
        }}
      >
        {/* Banner image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerUrl}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to bottom, rgba(13,31,60,0.3) 0%, rgba(13,31,60,0.75) 50%, rgba(13,31,60,0.97) 100%)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "56px 72px",
          }}
        >
          {/* LigaCup wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "white", fontSize: 30, fontWeight: 500 }}>Liga</span>
            <span style={{ color: "#e6a800", fontSize: 30, fontWeight: 800 }}>Cup</span>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 18, marginLeft: 6 }}>
              · VM 2026
            </span>
          </div>

          {/* League name + CTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontSize: leagueName.length > 20 ? 64 : 80,
                fontWeight: 800,
                color: "white",
                lineHeight: 1.05,
                maxWidth: 900,
              }}
            >
              {leagueName}
            </div>
            <span style={{ fontSize: 26, color: "rgba(255,255,255,0.6)" }}>
              {memberLabel}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 8 }}>
              <div
                style={{
                  background: "#e6a800",
                  color: "#0d1f3c",
                  fontSize: 24,
                  fontWeight: 700,
                  padding: "12px 32px",
                  borderRadius: 10,
                }}
              >
                Gå med och tippa
              </div>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 20 }}>
                Gratis · Inga insatser
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
