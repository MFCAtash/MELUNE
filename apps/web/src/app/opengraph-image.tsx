import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

export const alt =
  "MELUNE — a Persian-first music streaming and discovery app with 21 themes";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// The node build of @vercel/og resolves its bundled wasm via fileURLToPath,
// which throws "Invalid URL" on Windows during `next build`. The edge bundle
// does not have that path and produces the same image on `next start`.
export const runtime = "edge";

/**
 * Static OpenGraph/Twitter card rendered at build time. Deliberately uses the
 * default font (no network font fetch) so `next build` never depends on
 * Google Fonts being reachable from the build machine/CI.
 */
export default function OpengraphImage() {
  const host = new URL(SITE_URL).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "#FFFFFF",
          background:
            "linear-gradient(135deg, #0A0A0F 0%, #151025 55%, #24123D 100%)",
          position: "relative",
        }}
      >
        {/* Ambient brand glows */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(139,92,246,0.55) 0%, rgba(139,92,246,0) 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -220,
            left: -140,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(59,130,246,0) 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
            }}
          >
            M
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 12,
            }}
          >
            MELUNE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 86,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2.5,
            }}
          >
            Your Music. Smarter.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              lineHeight: 1.35,
              color: "#C4BEDC",
              maxWidth: 920,
            }}
          >
            Persian-first streaming, 21 themes and a five-cover Cover Flow hero
            — built for discovery, not just playback.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#918AAF",
          }}
        >
          <span>Streaming · Playlists · Offline · AI discovery</span>
          <span>{host}</span>
        </div>
      </div>
    ),
    size,
  );
}
