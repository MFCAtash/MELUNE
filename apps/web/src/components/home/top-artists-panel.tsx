"use client";

import Link from "next/link";
import type { Song } from "@melune/types";
import { useTranslation } from "@/hooks/use-translation";
import { formatCount } from "@/lib/format";
import { pickTopArtists } from "@/lib/home";
import { FollowArtistButton } from "@/components/library/follow-artist-button";
import { ArtistSpotlightCard } from "@/components/home/artist-spotlight-card";
import { Cover } from "@/components/ui/cover";
import { GlassPanel, PanelHeader } from "@/components/ui/glass-panel";

/** Artists ranked from the songs already on the Home feed. */
export function TopArtistsPanel({
  songs,
  limit = 4,
  variant = "list",
}: {
  songs: Song[];
  limit?: number;
  /** "list" — compact rows with a small round avatar (original layout).
   *  "spotlight" — full-bleed photo cards with Follow floating on the
   *  artwork, for shelves that want a more visual, gallery feel. */
  variant?: "list" | "spotlight";
}) {
  const { t, locale } = useTranslation();
  const artists = pickTopArtists(songs, limit);
  if (artists.length === 0) return null;

  return (
    <GlassPanel aria-labelledby="home-top-artists" className="p-5">
      <PanelHeader id="home-top-artists" title={t("home.topArtists")} />
      {variant === "spotlight" ? (
        <ul className="grid grid-cols-2 gap-3">
          {artists.map(({ artist, plays }) => (
            <ArtistSpotlightCard key={artist.id} artist={artist} plays={plays} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {artists.map(({ artist, plays }) => (
            <li
              key={artist.id}
              className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.07]"
            >
              <Link href={`/artist/${artist.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-lg ring-1 ring-white/10">
                  <Cover title={artist.name} url={artist.imageUrl} className="h-full w-full rounded-full text-lg" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{artist.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {t("home.plays", { count: formatCount(plays, locale) })}
                  </span>
                </span>
              </Link>
              <FollowArtistButton artistId={artist.id} name={artist.name} />
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
