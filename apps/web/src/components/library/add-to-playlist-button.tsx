"use client";

import { useEffect, useRef, useState } from "react";
import { ListPlus, Check } from "lucide-react";
import { ApiError } from "@melune/api-client";
import { flatItems, useAddSongToPlaylist, useMyPlaylists } from "@/lib/queries";
import { useAuthStore } from "@/store/auth-store";

export function AddToPlaylistButton({ songId }: { songId: string }) {
  const isAuthed = useAuthStore((s) => Boolean(s.user));
  const [open, setOpen] = useState(false);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only fetch once the menu is opened; the result is shared with the sidebar.
  const playlistsQuery = useMyPlaylists(open);
  const playlists = flatItems(playlistsQuery.data);
  const add = useAddSongToPlaylist();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!isAuthed) return null;

  const addTo = (playlistId: string) => {
    setError(null);
    add.mutate(
      { playlistId, songId },
      {
        onSuccess: () => setAddedTo((prev) => new Set(prev).add(playlistId)),
        onError: (err) =>
          setError(
            err instanceof ApiError && err.status === 400
              ? "That song is already in this playlist."
              : "Couldn't add this song. Try again.",
          ),
      },
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Add to playlist"
        className="hover:text-foreground"
        aria-label="Add to playlist"
        aria-expanded={open}
      >
        <ListPlus size={20} />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 z-10 mb-3 w-56 -translate-x-1/2 rounded-xl border border-border bg-surfaceElevated p-2 text-left shadow-glow">
          <p className="px-2 py-1 text-xs text-muted">Add to playlist</p>
          {(error || playlistsQuery.isError) && (
            <p role="alert" className="px-2 py-1 text-xs text-ember">
              {error ?? "Couldn't load your playlists."}
            </p>
          )}
          {playlistsQuery.isLoading && <p className="px-2 py-1 text-sm text-muted">Loading…</p>}
          {playlistsQuery.isSuccess && playlists.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted">
              No playlists yet — create one from the sidebar or your library.
            </p>
          )}
          <ul className="max-h-48 overflow-y-auto">
            {playlists.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => addTo(p.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface"
                >
                  <span className="truncate">{p.title}</span>
                  {addedTo.has(p.id) && <Check size={14} className="shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
