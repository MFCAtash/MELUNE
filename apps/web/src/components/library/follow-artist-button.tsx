"use client";

import { Check, UserPlus } from "lucide-react";
import { useSavedIds, useToggleSaved } from "@/lib/queries";
import { useAuthStore } from "@/store/auth-store";
import { useTranslation } from "@/hooks/use-translation";

/**
 * "Follow" pill. There is no social graph yet (Phase 11+), so this reuses
 * the existing library save for artists — following an artist adds them to
 * Library → Artists.
 */
export function FollowArtistButton({
  artistId,
  name,
  compact = false,
}: {
  artistId: string;
  name: string;
  /** Icon-only circular button, styled for sitting on top of artwork
   *  (e.g. the artist spotlight card) rather than inline in a list row. */
  compact?: boolean;
}) {
  const isAuthed = useAuthStore((s) => Boolean(s.user));
  const { data: savedIds, isLoading } = useSavedIds("artist");
  const toggle = useToggleSaved("artist");
  const { t } = useTranslation();

  if (!isAuthed) return null;

  const following = savedIds?.includes(artistId) ?? false;
  const Icon = following ? Check : UserPlus;
  const label = following ? t("home.following") : t("home.follow");

  if (compact) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle.mutate({ id: artistId, save: !following });
        }}
        disabled={isLoading}
        aria-pressed={following}
        aria-label={`${label}: ${name}`}
        title={label}
        // Always light-on-dark: this sits on the image's gradient scrim,
        // which is dark regardless of the app's light/dark theme.
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-colors disabled:opacity-50 ${
          following
            ? "border-primary/70 bg-primary/25 text-white"
            : "border-white/30 bg-black/20 text-white hover:border-primary hover:bg-primary/20"
        }`}
      >
        <Icon size={15} />
      </button>
    );
  }

  return (
    <button
      onClick={() => toggle.mutate({ id: artistId, save: !following })}
      disabled={isLoading}
      aria-pressed={following}
      aria-label={`${label}: ${name}`}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        following
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-white/15 text-foreground hover:border-primary hover:text-primary"
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
