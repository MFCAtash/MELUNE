import { create } from "zustand";

interface UiState {
  queueOpen: boolean;
  fullScreenOpen: boolean;
  focusModeOpen: boolean;
  shortcutsHelpOpen: boolean;
  commandPaletteOpen: boolean;
  createPlaylistOpen: boolean;

  toggleQueue: () => void;
  closeQueue: () => void;
  toggleFullScreen: () => void;
  openFullScreen: () => void;
  closeFullScreen: () => void;
  /** Focus Mode replaces the full-screen player and queue panel while it
   *  is open — opening it closes both, so leaving it returns to the app,
   *  not to an overlay that was hidden underneath. */
  openFocusMode: () => void;
  closeFocusMode: () => void;
  toggleFocusMode: () => void;
  toggleShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openCreatePlaylist: () => void;
  closeCreatePlaylist: () => void;
  /** Closes whichever overlay is open — used by the global Escape shortcut. */
  closeTopOverlay: () => boolean;
}

/**
 * Transient UI toggles that used to live as local `useState` inside
 * PersistentPlayer. Lifted here so the global keyboard-shortcuts handler
 * (mounted once near the root) can open/close them without prop drilling.
 * `createPlaylistOpen` joined them in Phase 6.7 so the command palette's
 * "Create playlist" quick action can trigger the same dialog AppShell
 * renders, instead of duplicating it.
 */
export const useUiStore = create<UiState>((set, get) => ({
  queueOpen: false,
  fullScreenOpen: false,
  focusModeOpen: false,
  shortcutsHelpOpen: false,
  commandPaletteOpen: false,
  createPlaylistOpen: false,

  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  closeQueue: () => set({ queueOpen: false }),
  toggleFullScreen: () => set((s) => ({ fullScreenOpen: !s.fullScreenOpen })),
  openFullScreen: () => set({ fullScreenOpen: true }),
  closeFullScreen: () => set({ fullScreenOpen: false }),
  openFocusMode: () => set({ focusModeOpen: true, fullScreenOpen: false, queueOpen: false }),
  closeFocusMode: () => set({ focusModeOpen: false }),
  toggleFocusMode: () =>
    set((s) =>
      s.focusModeOpen
        ? { focusModeOpen: false }
        : { focusModeOpen: true, fullScreenOpen: false, queueOpen: false },
    ),
  toggleShortcutsHelp: () => set((s) => ({ shortcutsHelpOpen: !s.shortcutsHelpOpen })),
  closeShortcutsHelp: () => set({ shortcutsHelpOpen: false }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  openCreatePlaylist: () => set({ createPlaylistOpen: true }),
  closeCreatePlaylist: () => set({ createPlaylistOpen: false }),

  closeTopOverlay: () => {
    const s = get();
    if (s.commandPaletteOpen) {
      set({ commandPaletteOpen: false });
      return true;
    }
    if (s.shortcutsHelpOpen) {
      set({ shortcutsHelpOpen: false });
      return true;
    }
    if (s.focusModeOpen) {
      set({ focusModeOpen: false });
      return true;
    }
    if (s.fullScreenOpen) {
      set({ fullScreenOpen: false });
      return true;
    }
    if (s.queueOpen) {
      set({ queueOpen: false });
      return true;
    }
    return false;
  },
}));
