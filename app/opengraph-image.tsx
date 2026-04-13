import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
        {/* LigaCup wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "white", fontSize: 36, fontWeight: 500 }}>
            Liga
          </span>
          <span style={{ color: "#e6a800", fontSize: 36, fontWeight: 800 }}>
            Cup
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.05,
            }}
          >
            Tipsa VM 2026 med{" "}
            <span style={{ color: "#e6a800" }}>dina vänner</span>
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Privat tipslag · Gratis · Inga insatser
          </div>
        </div>

        {/* CTA */}
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
          Skapa tipslag gratis →
        </div>
      </div>
    ),
    { ...size }
  );
}
