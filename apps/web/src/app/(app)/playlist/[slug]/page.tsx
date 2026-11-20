"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Globe, Lock, Pencil, Trash2, X } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import {
  playlistDetailKey,
  useDeletePlaylist,
  usePlaylist,
  useRemoveSongFromPlaylist,
  useReorderPlaylist,
  useUpdatePlaylist,
} from "@/lib/queries";
import { formatTotalDuration } from "@/lib/format";
import { PlaylistCover } from "@/components/library/playlist-cover";
import { PlaylistFormDialog } from "@/components/library/playlist-form-dialog";
import { SaveToLibraryButton } from "@/components/library/save-to-library-button";
import { PlayButton } from "@/components/player/play-button";
import { TrackList } from "@/components/player/track-list";
import { EmptyState } from "@/components/ui/empty-state";
import { NotFoundIllustration, EmptyPlaylistIllustration } from "@/components/ui/empty-illustrations";
import { Skeleton, TrackRowsSkeleton } from "@/components/ui/skeleton";

const iconButton =
  "rounded-md p-1 text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30";

function PlaylistSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <Skeleton className="h-44 w-44 rounded-2xl sm:h-56 sm:w-56" />
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <TrackRowsSkeleton />
    </div>
  );
}

export default function PlaylistPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const query = usePlaylist(params.slug);
  const detailKey = playlistDetailKey(params.slug, user?.id ?? null);

  const update = useUpdatePlaylist();
  const remove = useDeletePlaylist();
  const removeSong = useRemoveSongFromPlaylist(detailKey);
  const reorder = useReorderPlaylist(detailKey);
  const [editing, setEditing] = useState(false);

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-4xl py-6">
        <PlaylistSkeleton />
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="mx-auto max-w-4xl py-6">
        <EmptyState
          illustration={<NotFoundIllustration />}
          title="Playlist not found"
          description="It may have been deleted, or it's private to its owner."
          action={user ? { label: "Back to your library", href: "/library" } : { label: "Log in", href: `/login?next=${encodeURIComponent(`/playlist/${params.slug}`)}` }}
        />
      </main>
    );
  }

  const playlist = query.data;
  const isOwner = Boolean(user && (playlist.owner?.id === user.id));
  const songs = playlist.items.map((i) => i.song);
  const totalSeconds = songs.reduce((sum, s) => sum + s.duration, 0);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= songs.length) return;
    const ids = songs.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ playlistId: playlist.id, songIds: ids });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete “${playlist.title}”? This can't be undone.`)) return;
    await remove.mutateAsync(playlist.id);
    router.replace("/library");
  };

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 py-6">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <PlaylistCover
          title={playlist.title}
          seed={playlist.id}
          coverUrl={playlist.coverUrl}
          songs={songs}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            {playlist.isPublic ? <Globe size={14} /> : <Lock size={14} />}
            {playlist.isPublic ? "Public playlist" : "Private playlist"}
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold text-foreground sm:text-5xl">
            {playlist.title}
          </h1>
          {playlist.description && (
            <p className="mt-3 max-w-xl text-sm text-muted">{playlist.description}</p>
          )}
          <p className="mt-3 text-sm text-muted">
            {playlist.owner && <span className="text-foreground">{playlist.owner.username} · </span>}
            {songs.length} {songs.length === 1 ? "song" : "songs"}
            {songs.length > 0 && ` · ${formatTotalDuration(totalSeconds)}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PlayButton tracks={songs} label="Play" />
        {isOwner ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:border-primary"
            >
              <Pencil size={16} /> Edit
            </button>
            <button
              onClick={() =>
                update.mutate({ id: playlist.id, isPublic: !playlist.isPublic })
              }
              disabled={update.isPending}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:border-primary disabled:opacity-60"
            >
              {playlist.isPublic ? <Lock size={16} /> : <Globe size={16} />}
              {playlist.isPublic ? "Make private" : "Make public"}
            </button>
            <button
              onClick={handleDelete}
              disabled={remove.isPending}
              aria-label="Delete playlist"
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-red-400 hover:border-red-400 disabled:opacity-60"
            >
              <Trash2 size={16} /> Delete
            </button>
          </>
        ) : (
          <SaveToLibraryButton type="playlist" id={playlist.id} />
        )}
      </div>

      {songs.length === 0 ? (
        <EmptyState
          illustration={<EmptyPlaylistIllustration />}
          title="This playlist is empty"
          description={
            isOwner
              ? "Open any song and use its playlist button to add it here."
              : "Nothing has been added yet."
          }
          action={isOwner ? { label: "Find songs", href: "/home" } : undefined}
        />
      ) : (
        <TrackList
          tracks={songs}
          showArtist
          onReorder={
            isOwner
              ? (newOrder) =>
                  reorder.mutate({ playlistId: playlist.id, songIds: newOrder.map((s) => s.id) })
              : undefined
          }
          actions={
            isOwner
              ? (track, index) => (
                  <span className="flex items-center">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || reorder.isPending}
                      aria-label={`Move ${track.title} up`}
                      className={iconButton}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === songs.length - 1 || reorder.isPending}
                      aria-label={`Move ${track.title} down`}
                      className={iconButton}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      onClick={() =>
                        removeSong.mutate({ playlistId: playlist.id, songId: track.id })
                      }
                      aria-label={`Remove ${track.title} from playlist`}
                      className={iconButton}
                    >
                      <X size={16} />
                    </button>
                  </span>
                )
              : undefined
          }
        />
      )}

      {reorder.isError && (
        <p role="alert" className="text-sm text-red-400">
          Couldn&apos;t save the new order — it&apos;s been put back.
        </p>
      )}

      {isOwner && (
        <PlaylistFormDialog open={editing} onClose={() => setEditing(false)} playlist={playlist} />
      )}
    </main>
  );
}
