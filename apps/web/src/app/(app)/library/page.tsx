"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { LibraryItem, PlaylistSummary } from "@codex-music/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { flatItems, useMyLibrary, useMyLikes, useMyPlaylists } from "@/lib/queries";
import { MediaCard, mediaGridClass } from "@/components/library/media-card";
import { PlaylistFormDialog } from "@/components/library/playlist-form-dialog";
import { StatsPanel } from "@/components/library/stats-panel";
import { PlayButton } from "@/components/player/play-button";
import { TrackList } from "@/components/player/track-list";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ErrorIllustration,
  EmptyPlaylistIllustration,
  EmptyLikesIllustration,
  EmptyAlbumsIllustration,
  EmptyArtistsIllustration,
} from "@/components/ui/empty-illustrations";
import { CardGridSkeleton, TrackRowsSkeleton } from "@/components/ui/skeleton";

type Tab = "playlists" | "liked" | "albums" | "artists";
const TABS: { id: Tab; label: string }[] = [
  { id: "playlists", label: "Playlists" },
  { id: "liked", label: "Liked songs" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
];

function LoadMore({
  hasNextPage,
  isFetching,
  onClick,
}: {
  hasNextPage: boolean;
  isFetching: boolean;
  onClick: () => void;
}) {
  if (!hasNextPage) return null;
  return (
    <button
      onClick={onClick}
      disabled={isFetching}
      className="mx-auto mt-6 block rounded-xl border border-border px-5 py-2 text-sm text-foreground hover:border-primary disabled:opacity-60"
    >
      {isFetching ? "Loading…" : "Load more"}
    </button>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      illustration={<ErrorIllustration />}
      title="Couldn't load this section"
      description="Check your connection and try again."
      action={{ label: "Try again", onClick: onRetry }}
    />
  );
}

function PlaylistGrid({ items }: { items: PlaylistSummary[] }) {
  return (
    <div className={mediaGridClass}>
      {items.map((p) => (
        <MediaCard
          key={p.id}
          href={`/playlist/${p.slug}`}
          title={p.title}
          subtitle={p.owner ? `By ${p.owner.username}` : p.isPublic ? "Public" : "Private"}
          coverUrl={p.coverUrl}
          seed={p.id}
        />
      ))}
    </div>
  );
}

function PlaylistsTab({ onCreate }: { onCreate: () => void }) {
  const mine = useMyPlaylists();
  const saved = useMyLibrary("playlist");
  const myItems = flatItems(mine.data);
  const savedPlaylists = flatItems(saved.data)
    .map((i: LibraryItem) => i.playlist)
    .filter((p): p is PlaylistSummary => Boolean(p));

  if (mine.isLoading) return <CardGridSkeleton />;
  if (mine.isError) return <QueryError onRetry={() => mine.refetch()} />;

  return (
    <div className="flex flex-col gap-10">
      {myItems.length === 0 ? (
        <EmptyState
          illustration={<EmptyPlaylistIllustration />}
          title="Start your first playlist"
          description="Group songs by mood, moment or artist. Add songs from any track's playlist button."
          action={{ label: "Create playlist", onClick: onCreate }}
        />
      ) : (
        <div>
          <PlaylistGrid items={myItems} />
          <LoadMore
            hasNextPage={mine.hasNextPage}
            isFetching={mine.isFetchingNextPage}
            onClick={() => mine.fetchNextPage()}
          />
        </div>
      )}

      {savedPlaylists.length > 0 && (
        <section aria-label="Saved playlists">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Saved from others</h2>
          <PlaylistGrid items={savedPlaylists} />
          <LoadMore
            hasNextPage={saved.hasNextPage}
            isFetching={saved.isFetchingNextPage}
            onClick={() => saved.fetchNextPage()}
          />
        </section>
      )}
    </div>
  );
}

function LikedTab() {
  const likes = useMyLikes();
  const songs = flatItems(likes.data);

  if (likes.isLoading) return <TrackRowsSkeleton />;
  if (likes.isError) return <QueryError onRetry={() => likes.refetch()} />;
  if (songs.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyLikesIllustration />}
        title="No liked songs yet"
        description="Tap the heart on any song and it lands here."
        action={{ label: "Find something to play", href: "/home" }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PlayButton tracks={songs} label="Play liked songs" />
      <TrackList tracks={songs} showArtist />
      <LoadMore
        hasNextPage={likes.hasNextPage}
        isFetching={likes.isFetchingNextPage}
        onClick={() => likes.fetchNextPage()}
      />
    </div>
  );
}

function AlbumsTab() {
  const query = useMyLibrary("album");
  const albums = flatItems(query.data).flatMap((i) => (i.album ? [i.album] : []));

  if (query.isLoading) return <CardGridSkeleton />;
  if (query.isError) return <QueryError onRetry={() => query.refetch()} />;
  if (albums.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyAlbumsIllustration />}
        title="No saved albums"
        description="Open an album and choose “Save to library” to keep it here."
        action={{ label: "Browse Home", href: "/home" }}
      />
    );
  }
  return (
    <>
      <div className={mediaGridClass}>
        {albums.map((a) => (
          <MediaCard
            key={a.id}
            href={`/album/${a.slug}`}
            title={a.title}
            subtitle={a.artist.name}
            coverUrl={a.coverUrl}
          />
        ))}
      </div>
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetching={query.isFetchingNextPage}
        onClick={() => query.fetchNextPage()}
      />
    </>
  );
}

function ArtistsTab() {
  const query = useMyLibrary("artist");
  const artists = flatItems(query.data).flatMap((i) => (i.artist ? [i.artist] : []));

  if (query.isLoading) return <CardGridSkeleton />;
  if (query.isError) return <QueryError onRetry={() => query.refetch()} />;
  if (artists.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyArtistsIllustration />}
        title="No saved artists"
        description="Open an artist and choose “Save to library” to keep them here."
        action={{ label: "Browse Home", href: "/home" }}
      />
    );
  }
  return (
    <>
      <div className={mediaGridClass}>
        {artists.map((a) => (
          <MediaCard
            key={a.id}
            href={`/artist/${a.slug}`}
            title={a.name}
            subtitle="Artist"
            coverUrl={a.imageUrl}
            round
          />
        ))}
      </div>
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetching={query.isFetchingNextPage}
        onClick={() => query.fetchNextPage()}
      />
    </>
  );
}

export default function LibraryPage() {
  const { isChecking } = useRequireAuth();
  const [tab, setTab] = useState<Tab>("playlists");
  const [creating, setCreating] = useState(false);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Your library</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:border-primary"
        >
          <Plus size={16} /> New playlist
        </button>
      </div>

      <StatsPanel />

      <div role="tablist" aria-label="Library sections" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
              tab === t.id
                ? "bg-primary text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {isChecking ? (
          <CardGridSkeleton />
        ) : (
          <>
            {tab === "playlists" && <PlaylistsTab onCreate={() => setCreating(true)} />}
            {tab === "liked" && <LikedTab />}
            {tab === "albums" && <AlbumsTab />}
            {tab === "artists" && <ArtistsTab />}
          </>
        )}
      </div>

      <PlaylistFormDialog open={creating} onClose={() => setCreating(false)} />
    </main>
  );
}
