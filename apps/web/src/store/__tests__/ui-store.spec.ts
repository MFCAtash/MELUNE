import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "../ui-store";

beforeEach(() => {
  useUiStore.setState({
    queueOpen: false,
    fullScreenOpen: false,
    focusModeOpen: false,
    shortcutsHelpOpen: false,
    commandPaletteOpen: false,
    createPlaylistOpen: false,
  });
});

describe("ui-store focus mode", () => {
  it("opening focus mode closes the full-screen player and the queue panel", () => {
    useUiStore.setState({ fullScreenOpen: true, queueOpen: true });
    useUiStore.getState().openFocusMode();
    const s = useUiStore.getState();
    expect(s.focusModeOpen).toBe(true);
    expect(s.fullScreenOpen).toBe(false);
    expect(s.queueOpen).toBe(false);
  });

  it("toggleFocusMode opens and closes", () => {
    useUiStore.getState().toggleFocusMode();
    expect(useUiStore.getState().focusModeOpen).toBe(true);
    useUiStore.getState().toggleFocusMode();
    expect(useUiStore.getState().focusModeOpen).toBe(false);
  });

  it("Escape closes focus mode ahead of the queue, but behind dialogs", () => {
    useUiStore.setState({ focusModeOpen: true, queueOpen: true, shortcutsHelpOpen: true });

    expect(useUiStore.getState().closeTopOverlay()).toBe(true);
    expect(useUiStore.getState().shortcutsHelpOpen).toBe(false);
    expect(useUiStore.getState().focusModeOpen).toBe(true);

    expect(useUiStore.getState().closeTopOverlay()).toBe(true);
    expect(useUiStore.getState().focusModeOpen).toBe(false);
    expect(useUiStore.getState().queueOpen).toBe(true);
  });
});
