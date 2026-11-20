import { describe, it, expect } from "vitest";
import { findShortcut, isEditableTarget, matchesShortcut, PLAYER_SHORTCUTS } from "../shortcuts";

function key(
  k: string,
  mods: Partial<{ shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {},
) {
  return {
    key: k,
    shiftKey: mods.shiftKey ?? false,
    altKey: mods.altKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
  };
}

describe("matchesShortcut", () => {
  it("matches space to play/pause", () => {
    const def = PLAYER_SHORTCUTS.find((d) => d.id === "playPause")!;
    expect(matchesShortcut(key(" "), def)).toBe(true);
  });

  it("distinguishes seek from track-skip on the same arrow key via Shift", () => {
    const seek = PLAYER_SHORTCUTS.find((d) => d.id === "seekForward")!;
    const skip = PLAYER_SHORTCUTS.find((d) => d.id === "next")!;
    expect(matchesShortcut(key("ArrowRight"), seek)).toBe(true);
    expect(matchesShortcut(key("ArrowRight"), skip)).toBe(false);
    expect(matchesShortcut(key("ArrowRight", { shiftKey: true }), skip)).toBe(true);
    expect(matchesShortcut(key("ArrowRight", { shiftKey: true }), seek)).toBe(false);
  });

  it("never matches when Ctrl/Cmd is held, so it doesn't fight browser shortcuts", () => {
    const mute = PLAYER_SHORTCUTS.find((d) => d.id === "mute")!;
    expect(matchesShortcut(key("m", { ctrlKey: true }), mute)).toBe(false);
    expect(matchesShortcut(key("m", { metaKey: true }), mute)).toBe(false);
  });

  it("is case-insensitive on the key itself", () => {
    const shuffle = PLAYER_SHORTCUTS.find((d) => d.id === "shuffle")!;
    expect(matchesShortcut(key("S"), shuffle)).toBe(true);
  });
});

describe("findShortcut", () => {
  it("returns the matching definition or undefined", () => {
    expect(findShortcut(key("q"))?.id).toBe("toggleQueue");
    expect(findShortcut(key("t"))?.id).toBe("toggleFocusMode");
    expect(findShortcut(key("z"))).toBeUndefined();
  });
});

describe("isEditableTarget", () => {
  it("flags form fields and contenteditable elements", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    const editableDiv = document.createElement("div");
    Object.defineProperty(editableDiv, "isContentEditable", { value: true });

    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(editableDiv)).toBe(true);
    expect(isEditableTarget(null)).toBe(false);
  });
});
