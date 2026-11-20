import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

/** Shared visual language for every dynamic OpenGraph card. Kept in one
 *  place so song / album / playlist / artist shares all look like the
 *  same product, and the site-wide static card (app/opengraph-image.tsx)
 *  can be aligned later without touching each route. */

export const OG_SIZE = { width: 1200, height: 630 };

export interface OgCardOptions {
  kind: string;
  title: string;
  subtitle: string;
  meta?: string;
  coverUrl?: string | null;
  fallbackText?: string;
  from?: string;
  to?: string;
}

export function OgCard({
  kind,
  title,
  subtitle,
  meta,
  coverUrl,
  fallbackText,
  from = "#0A0A0F",
  to = "#151025",
}: OgCardOptions) {
  const imageSrc = coverUrl
    ? coverUrl.startsWith("http")
      ? coverUrl
      : new URL(coverUrl, SITE_URL).toString()
    : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "space-between",
        padding: 64,
        color: "#FFFFFF",
        background: `linear-gradient(135deg, ${from} 0%, #111827 50%, ${to} 100%)`,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          top: -160,
          width: 620,
          height: 620,
          borderRadius: 9999,
          background: "radial-gradient(circle, rgba(61,220,151,0.28) 0%, rgba(61,220,151,0) 70%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -140,
          bottom: -220,
          width: 640,
          height: 640,
          borderRadius: 9999,
          background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0) 70%)",
          display: "flex",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 610 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 800,
              background: "linear-gradient(135deg,#3DDC97 0%,#38BDF8 100%)",
            }}
          >
            M
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 8 }}>MELUNE</div>
        </div>

        <div style={{ display: "flex", fontSize: 19, letterSpacing: 4, color: "#6EE7B7", textTransform: "uppercase" }}>
          {kind}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#C9E8DC" }}>{subtitle}</div>
          {meta ? <div style={{ display: "flex", fontSize: 22, color: "#8FB8A8" }}>{meta}</div> : null}
        </div>

        <div style={{ display: "flex", fontSize: 18, color: "#7EA295", letterSpacing: 2 }}>
          {new URL(SITE_URL).host} · YOUR MUSIC. SMARTER.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: 400,
          height: 400,
          alignSelf: "center",
          borderRadius: 36,
          overflow: "hidden",
          background: "linear-gradient(135deg,#164E3B 0%,#312E81 100%)",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
        }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" width={400} height={400} style={{ width: 400, height: 400, objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", fontSize: 150, fontWeight: 800, opacity: 0.85 }}>
            {(fallbackText ?? title).slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

export function renderOgCard(options: OgCardOptions) {
  return new ImageResponse(<OgCard {...options} />, OG_SIZE);
}
