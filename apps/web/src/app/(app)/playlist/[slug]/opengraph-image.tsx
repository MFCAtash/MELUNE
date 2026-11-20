import { catalog } from "@/lib/catalog";
import { renderOgCard } from "@/lib/og-card";

export const alt = "MELUNE — playlist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default async function Image({ params }: { params: { slug: string } }) {
  let playlist: Awaited<ReturnType<typeof catalog.getPlaylist>> = null;
  try {
    playlist = await catalog.getPlaylist(params.slug);
  } catch {
    playlist = null;
  }

  return renderOgCard({
    kind: "Playlist",
    title: playlist?.title ?? "MELUNE",
    subtitle: playlist?.description || "A playlist made for listening together",
    meta: playlist?.items ? `${playlist.items.length} songs` : undefined,
    coverUrl: playlist?.coverUrl,
    fallbackText: playlist?.title ?? "MELUNE",
    from: "#06120F",
    to: "#0A2C22",
  });
}
