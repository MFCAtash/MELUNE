"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/store/player-store";
import { useUiStore } from "@/store/ui-store";
import { findShortcut, isEditableTarget, SEEK_STEP_SECONDS, VOLUME_STEP } from "@/lib/shortcuts";

/**
 * Mounted once near the app root (see KeyboardShortcutsProvider). Listens
 * on `document` so shortcuts work regardless of which element has focus,
 * but backs off completely while the user is typing into a field, or
 * while a browser-level modifier (Ctrl/Cmd/Alt) is held — those are left
 * to the OS and the browser.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (useUiStore.getState().closeTopOverlay()) e.preventDefault();
        return;
      }

      // Cmd/Ctrl+K opens the search palette from anywhere — like Escape,
      // this runs before the editable-target check, since typing a
      // playlist title shouldn't block jumping into search.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUiStore.getState().openCommandPalette();
        return;
      }

      if (isEditableTarget(e.target)) return;

      const shortcut = findShortcut(e);
      if (!shortcut) return;

      const player = usePlayerStore.getState();
      const ui = useUiStore.getState();

      // Focus Mode covers everything; the queue panel and full-screen
      // player would open invisibly underneath it, so those two keys do
      // nothing until it is closed.
      if (ui.focusModeOpen && (shortcut.id === "toggleQueue" || shortcut.id === "toggleFullScreen")) return;

      switch (shortcut.id) {
        case "playPause":
          player.togglePlay();
          break;
        case "next":
          player.next();
          break;
        case "previous":
          player.previous();
          break;
        case "seekForward":
          player.seek(Math.min(player.duration || player.currentTime, player.currentTime + SEEK_STEP_SECONDS));
          break;
        case "seekBack":
          player.seek(Math.max(0, player.currentTime - SEEK_STEP_SECONDS));
          break;
        case "volumeUp":
          player.setVolume(Math.min(1, Number((player.volume + VOLUME_STEP).toFixed(2))));
          break;
        case "volumeDown":
          player.setVolume(Math.max(0, Number((player.volume - VOLUME_STEP).toFixed(2))));
          break;
        case "mute":
          player.toggleMute();
          break;
        case "shuffle":
          player.toggleShuffle();
          break;
        case "repeat":
          player.cycleRepeat();
          break;
        case "toggleQueue":
          ui.toggleQueue();
          break;
        case "toggleFullScreen":
          ui.toggleFullScreen();
          break;
        case "toggleFocusMode":
          // Needs something playing — Focus Mode is a player view.
          if (player.queue.length > 0) ui.toggleFocusMode();
          break;
        case "showHelp":
          ui.toggleShortcutsHelp();
          break;
      }

      e.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
