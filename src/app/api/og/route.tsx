import { ImageResponse } from "next/og";
import { getAppUrl } from "@/lib/env";

export const runtime = "edge";

/** Dynamic OG image for /track?code=… */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim().toUpperCase() || "IM-TRK-…";
  const lang = searchParams.get("lang") === "en" ? "en" : "id";
  const title = lang === "en" ? "Order progress tracking" : "Lacak progress pesanan";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #0091d5 0%, #0077b0 45%, #1a1a1a 100%)",
          color: "#fff",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            Indah Mesin
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, maxWidth: 900 }}>{title}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: "28px 32px",
          }}
        >
          <div style={{ fontSize: 22, opacity: 0.85 }}>Tracking</div>
          <div style={{ fontSize: 40, fontFamily: "monospace", fontWeight: 700 }}>{code}</div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.8 }}>{getAppUrl().replace(/^https?:\/\//, "")}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
