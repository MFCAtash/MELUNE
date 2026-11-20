"use client";

import Link from "next/link";
import type { ArtistSummary } from "@melune/types";
import { useTranslation } from "@/hooks/use-translation";
import { formatCount } from "@/lib/format";
import { FollowArtistButton } from "@/components/library/follow-artist-button";
import { Cover } from "@/components/ui/cover";

/**
 * Big, image-led artist tile: full-bleed photo, gradient scrim, name +
 * play count pinned to the bottom, Follow floating on top of the artwork.
 * An alternative to `TopArtistsPanel`'s list rows for layouts that want a
 * gallery feel (e.g. a "Popular artists" shelf on Home/Discover).
 *
 * There's no follower graph yet (see `FollowArtistButton`'s note), so the
 * stat shown is total plays across the artist's songs on this feed — the
 * same number `TopArtistsPanel` already surfaces — rather than a follower
 * count, which the API doesn't have.
 */
export function ArtistSpotlightCard({ artist, plays }: { artist: ArtistSummary; plays: number }) {
  const { t, locale } = useTranslation();

  return (
    <li className="relative aspect-[3/4] overflow-hidden rounded-2xl">
      <Link href={`/artist/${artist.slug}`} className="absolute inset-0">
        <Cover
          title={artist.name}
          url={artist.imageUrl}
          seed={artist.id}
          className="absolute inset-0 h-full w-full rounded-none text-4xl"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="truncate text-sm font-semibold text-white">{artist.name}</p>
          <p className="truncate text-xs text-white/70">
            {t("home.plays", { count: formatCount(plays, locale) })}
          </p>
        </div>
      </Link>
      <div className="absolute end-3 top-3">
        <FollowArtistButton artistId={artist.id} name={artist.name} compact />
      </div>
    </li>
  );
}
