"use client";

import Link from "next/link";
import { flatItems, useMyPlaylists } from "@/lib/queries";
import { useTranslation } from "@/hooks/use-translation";
import { Cover } from "@/components/ui/cover";
import { GlassPanel, PanelHeader } from "@/components/ui/glass-panel";
import { Skeleton } from "@/components/ui/skeleton";

/** The user's own playlists as tall artwork cards with a title scrim. */
export function PlaylistsPanel({ limit = 3 }: { limit?: number }) {
  const query = useMyPlaylists();
  const { t } = useTranslation();
  const playlists = flatItems(query.data).slice(0, limit);

  return (
    <GlassPanel aria-labelledby="home-playlists" className="p-5">
      <PanelHeader id="home-playlists" title={t("home.yourPlaylists")} />

      {query.isLoading && (
        <div role="status" aria-label={t("common.loading")} className="grid grid-cols-3 gap-3">
          {Array.from({ length: limit }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      )}

      {query.isError && <p role="alert" className="text-sm text-ember">{t("home.playlistsError")}</p>}

      {query.isSuccess && playlists.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted">
          {t("home.noPlaylists")}
        </p>
      )}

      {playlists.length > 0 && (
        <ul className="grid grid-cols-3 gap-3">
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              <Link
                href={`/playlist/${playlist.slug}`}
                aria-label={`${t("home.openPlaylist")}: ${playlist.title}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/10 transition-shadow hover:shadow-glow"
              >
                <Cover
                  title={playlist.title}
                  url={playlist.coverUrl}
                  seed={playlist.id}
                  className="h-full w-full text-5xl motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-cover-scrim" />
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="block truncate text-sm font-semibold text-foreground">{playlist.title}</span>
                  {playlist.description && (
                    <span className="block truncate text-xs text-foreground/70">{playlist.description}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
