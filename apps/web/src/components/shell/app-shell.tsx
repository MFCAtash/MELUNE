"use client";

import { PlaylistFormDialog } from "@/components/library/playlist-form-dialog";
import { CommandPalette } from "@/components/search/command-palette";
import { PlasmaBackground } from "@/components/player/plasma-background";
import { useTranslation } from "@/hooks/use-translation";
import { useAmbientTheme } from "@/hooks/use-ambient-theme";
import { useUiStore } from "@/store/ui-store";
import { usePlayerStore } from "@/store/player-store";
import type { CSSProperties } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";

/**
 * The frame around every in-app page: sidebar (desktop), top bar, and a
 * floating bottom nav (phones). The persistent player sits above/beside
 * it — see PersistentPlayer, which lifts itself over the bottom nav.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const creating = useUiStore((s) => s.createPlaylistOpen);
  const focusModeOpen = useUiStore((s) => s.focusModeOpen);
  const openCreating = useUiStore((s) => s.openCreatePlaylist);
  const closeCreating = useUiStore((s) => s.closeCreatePlaylist);
  const { t } = useTranslation();

  // Same track → same ambient color as the full-screen player (see
  // useAmbientTheme), so the whole app shell — not just the player —
  // now drifts gently toward the current song's tone. Respects the
  // user's Static/Dynamic/System ambient-mode choice (Phase 10.1) and
  // is always contrast-safety-clamped before it reaches this surface.
  const track = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const { color: ambientColor } = useAmbientTheme(
    track?.coverUrl,
    track ? `${track.title}-${track.artist.name}` : "codex-app-ambient",
  );

  return (
    <div className="relative isolate min-h-screen bg-background">
      {/* Ambient purple/blue light behind every page; purely decorative. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-app-glow" />
      {/* Slow drifting aurora blobs (CSS-only) behind every page — the
          "alive" layer over the static glow. Tinted by the currently
          playing track's ambient color (falls back to brand purple when
          nothing plays or ambient mode is Static-with-default). Unmounted
          in Focus Mode so its promise of a still background holds. */}
      {!focusModeOpen && (
        <div
          aria-hidden
          className="app-aurora"
          style={{ "--aurora-a": ambientColor } as CSSProperties}
        />
      )}
      {/* Faint, app-wide plasma wash tinted by the currently playing track.
          See PlasmaBackground's "ambient" mode for the guardrails this
          preserves (motion-safe, aria-hidden, pointer-events-none). */}
      {/* Focus Mode promises a completely still background, so the
          animated wash is unmounted (not merely hidden) while it's open. */}
      {!focusModeOpen && <PlasmaBackground color={ambientColor} intensity="ambient" />}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t("nav.skipToContent")}
      </a>
      <Sidebar onCreatePlaylist={openCreating} />
      <div className="md:ps-60">
        <Topbar />
        {/* Bottom padding clears the mini-player + bottom nav (phones) or the player bar (desktop). */}
        <div id="content" tabIndex={-1} className="px-4 pb-44 outline-none sm:px-6 md:pb-32 lg:px-8">
          {children}
        </div>
      </div>
      <BottomNav />
      <PlaylistFormDialog open={creating} onClose={closeCreating} />
      <CommandPalette />
    </div>
  );
}
