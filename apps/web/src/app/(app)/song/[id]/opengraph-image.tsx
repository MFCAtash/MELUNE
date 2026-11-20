import { catalog } from "@/lib/catalog";
import { renderOgCard } from "@/lib/og-card";

export const alt = "MELUNE — track";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Same Windows `next build` constraint as the site-wide card: the edge
// bundle doesn't resolve @vercel/og's wasm through fileURLToPath.
export const runtime = "edge";

export default async function Image({ params }: { params: { id: string } }) {
  // A share must always render an image — never a 500 — even when the
  // API is briefly unreachable or the slug is wrong.
  let song: Awaited<ReturnType<typeof catalog.getSong>> = null;
  try {
    song = await catalog.getSong(params.id);
  } catch {
    song = null;
  }

  return renderOgCard({
    kind: "Track",
    title: song?.title ?? "MELUNE",
    subtitle: song?.artist?.name ?? "Your Music. Smarter.",
    meta: song?.album?.title ? `From “${song.album.title}”` : undefined,
    coverUrl: song?.coverUrl,
    fallbackText: song?.title ?? "MELUNE",
    from: "#04140F",
    to: "#0B2E23",
  });
}
