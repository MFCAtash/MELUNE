import { catalog } from "@/lib/catalog";
import { renderOgCard } from "@/lib/og-card";

export const alt = "MELUNE — album";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default async function Image({ params }: { params: { id: string } }) {
  let album: Awaited<ReturnType<typeof catalog.getAlbum>> = null;
  try {
    album = await catalog.getAlbum(params.id);
  } catch {
    album = null;
  }

  return renderOgCard({
    kind: "Album",
    title: album?.title ?? "MELUNE",
    subtitle: album?.artist?.name ?? "Your Music. Smarter.",
    meta: album?.artist?.name ? `By ${album.artist.name}` : undefined,
    coverUrl: album?.coverUrl,
    fallbackText: album?.title ?? "MELUNE",
    from: "#0B0716",
    to: "#1B1140",
  });
}
