"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useLikedIds, useToggleLike } from "@/lib/queries";
import { useAuthStore } from "@/store/auth-store";

/**
 * Like/unlike toggle. The initial state comes from the user's liked-songs
 * cache (React Query) and toggles optimistically against the real
 * /songs/:id/like API — so hearts you've already given show as filled.
 *
 * Known limit: the ids cache covers the 100 most recent likes; an older
 * like would still show unfilled until `Song` carries a per-viewer
 * `isLiked` flag from the API.
 */
export function LikeButton({ songId, size = 18 }: { songId: string; size?: number }) {
  const isAuthed = useAuthStore((s) => Boolean(s.user));
  const { data: likedIds } = useLikedIds();
  const toggle = useToggleLike();
  const [justLiked, setJustLiked] = useState(false);

  if (!isAuthed) return null;

  const liked = likedIds?.includes(songId) ?? false;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const like = !liked;
    if (like) {
      setJustLiked(true);
      setTimeout(() => setJustLiked(false), 420);
    }
    toggle.mutate({ songId, like });
  };

  return (
    <button
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={`shrink-0 text-muted transition-colors hover:text-primary ${
        justLiked ? "animate-heart-burst" : ""
      }`}
    >
      <Heart size={size} fill={liked ? "currentColor" : "none"} className={liked ? "text-primary" : ""} />
    </button>
  );
}
