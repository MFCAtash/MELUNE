"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSavedIds, useToggleSaved, type SavableType } from "@/lib/queries";
import { useAuthStore } from "@/store/auth-store";

/** Save/unsave an album, artist or playlist to the user's library. */
export function SaveToLibraryButton({ type, id }: { type: SavableType; id: string }) {
  const isAuthed = useAuthStore((s) => Boolean(s.user));
  const { data: savedIds, isLoading } = useSavedIds(type);
  const toggle = useToggleSaved(type);

  if (!isAuthed) return null;

  const saved = savedIds?.includes(id) ?? false;
  const Icon = saved ? BookmarkCheck : Bookmark;

  return (
    <button
      onClick={() => toggle.mutate({ id, save: !saved })}
      disabled={isLoading}
      aria-pressed={saved}
      className={`flex w-fit items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        saved
          ? "border-primary text-primary"
          : "border-border text-foreground hover:border-primary"
      }`}
    >
      <Icon size={18} />
      {saved ? "Saved" : "Save to library"}
    </button>
  );
}
