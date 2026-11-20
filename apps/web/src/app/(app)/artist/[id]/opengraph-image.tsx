import { catalog } from "@/lib/catalog";
import { renderOgCard } from "@/lib/og-card";

export const alt = "MELUNE — artist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default async function Image({ params }: { params: { id: string } }) {
  let artist: Awaited<ReturnType<typeof catalog.getArtist>> = null;
  try {
    artist = await catalog.getArtist(params.id);
  } catch {
    artist = null;
  }

  return renderOgCard({
    kind: "Artist",
    title: artist?.name ?? "MELUNE",
    subtitle: "Listen on MELUNE",
    meta: artist?.bio ?? undefined,
    coverUrl: artist?.imageUrl,
    fallbackText: artist?.name ?? "MELUNE",
    from: "#120A18",
    to: "#2B0B2E",
  });
}
