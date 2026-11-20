"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@melune/api-client";
import type { PlaylistSummary } from "@melune/types";
import { useCreatePlaylist, useUpdatePlaylist } from "@/lib/queries";
import { ACCENT_COLORS } from "@/lib/cover";

/** Create a playlist, or edit one when `playlist` is passed. */
export function PlaylistFormDialog({
  open,
  onClose,
  playlist,
}: {
  open: boolean;
  onClose: () => void;
  playlist?: PlaylistSummary;
}) {
  const router = useRouter();
  const create = useCreatePlaylist();
  const update = useUpdatePlaylist();
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the dialog opens (not on every cache refresh).
  useEffect(() => {
    if (!open) return;
    setTitle(playlist?.title ?? "");
    setDescription(playlist?.description ?? "");
    setIsPublic(playlist?.isPublic ?? true);
    setAccentColor(playlist?.accentColor ?? null);
    setError(null);
    titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isEdit = Boolean(playlist);
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name) {
      setError("Give your playlist a name.");
      return;
    }
    setError(null);
    try {
      if (playlist) {
        const updated = await update.mutateAsync({
          id: playlist.id,
          title: name,
          description: description.trim(),
          accentColor,
          isPublic,
        });
        onClose();
        if (updated.slug !== playlist.slug) router.replace(`/playlist/${updated.slug}`);
      } else {
        const created = await create.mutateAsync({
          title: name,
          description: description.trim() || undefined,
          accentColor: accentColor ?? undefined,
          isPublic,
        });
        onClose();
        router.push(`/playlist/${created.slug}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the playlist. Try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-dialog-title"
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <h2 id="playlist-dialog-title" className="text-xl font-semibold text-foreground">
          {isEdit ? "Edit playlist" : "New playlist"}
        </h2>

        <label className="mt-5 block text-sm">
          <span className="mb-1.5 block text-muted">Name</span>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-border bg-surfaceElevated px-3.5 py-2.5 text-foreground outline-none transition focus:border-primary"
          />
        </label>

        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block text-muted">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-surfaceElevated px-3.5 py-2.5 text-foreground outline-none transition focus:border-primary"
          />
        </label>

        <div className="mt-4">
          <span className="mb-1.5 block text-sm text-muted">Color</span>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Playlist color">
            <button
              type="button"
              role="radio"
              aria-checked={accentColor === null}
              title="Auto"
              onClick={() => setAccentColor(null)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-surfaceElevated text-[10px] font-medium transition ${
                accentColor === null
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:border-border"
              }`}
            >
              Auto
            </button>
            {ACCENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={accentColor === color}
                aria-label={color}
                onClick={() => setAccentColor(color)}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  accentColor === color ? "border-primary" : "border-transparent hover:border-border"
                }`}
                style={{ background: color }}
              >
                {accentColor === color && <span className="text-xs font-bold text-white">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Anyone with the link can view this playlist
        </label>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:border-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-melune-gradient rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create playlist"}
          </button>
        </div>
      </form>
    </div>
  );
}
