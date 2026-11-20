import type { TranslationKey } from "@/lib/i18n/translate";

export type ShortcutId =
  | "playPause"
  | "next"
  | "previous"
  | "seekForward"
  | "seekBack"
  | "volumeUp"
  | "volumeDown"
  | "mute"
  | "shuffle"
  | "repeat"
  | "toggleQueue"
  | "toggleFullScreen"
  | "toggleFocusMode"
  | "showHelp";

export interface ShortcutDef {
  id: ShortcutId;
  /** Lowercased `KeyboardEvent.key` values that trigger this action. */
  keys: string[];
  /** Required Shift state. `undefined` means "don't care" (used for
   *  character keys like "?" where Shift is already baked into `key`). */
  shift?: boolean;
  /** Required Alt state; defaults to `false` (not held). */
  alt?: boolean;
  /** Required Ctrl-or-Cmd state; defaults to `false` (not held), so this
   *  never fights the browser's own Ctrl/Cmd shortcuts. */
  ctrlOrMeta?: boolean;
  labelKey: TranslationKey;
}

/**
 * Global player shortcuts. Arrow keys are dual-purpose: alone they seek,
 * with Shift they skip tracks — mirroring the convention most desktop
 * players (and video sites) use.
 */
export const PLAYER_SHORTCUTS: readonly ShortcutDef[] = [
  { id: "playPause", keys: [" ", "spacebar"], labelKey: "shortcuts.playPause" },
  { id: "next", keys: ["arrowright"], shift: true, labelKey: "shortcuts.next" },
  { id: "previous", keys: ["arrowleft"], shift: true, labelKey: "shortcuts.previous" },
  { id: "seekForward", keys: ["arrowright"], shift: false, labelKey: "shortcuts.seekForward" },
  { id: "seekBack", keys: ["arrowleft"], shift: false, labelKey: "shortcuts.seekBack" },
  { id: "volumeUp", keys: ["arrowup"], labelKey: "shortcuts.volumeUp" },
  { id: "volumeDown", keys: ["arrowdown"], labelKey: "shortcuts.volumeDown" },
  { id: "mute", keys: ["m"], labelKey: "shortcuts.mute" },
  { id: "shuffle", keys: ["s"], labelKey: "shortcuts.shuffle" },
  { id: "repeat", keys: ["r"], labelKey: "shortcuts.repeat" },
  { id: "toggleQueue", keys: ["q"], labelKey: "shortcuts.toggleQueue" },
  { id: "toggleFullScreen", keys: ["f"], labelKey: "shortcuts.toggleFullScreen" },
  { id: "toggleFocusMode", keys: ["t"], labelKey: "shortcuts.toggleFocusMode" },
  { id: "showHelp", keys: ["?"], labelKey: "shortcuts.showHelp" },
];

export const SEEK_STEP_SECONDS = 5;
export const VOLUME_STEP = 0.1;

interface MinimalKeyboardEvent {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function matchesShortcut(e: MinimalKeyboardEvent, def: ShortcutDef): boolean {
  if (!def.keys.includes(e.key.toLowerCase())) return false;
  if (def.shift !== undefined && e.shiftKey !== def.shift) return false;
  if ((def.alt ?? false) !== e.altKey) return false;
  if ((def.ctrlOrMeta ?? false) !== (e.ctrlKey || e.metaKey)) return false;
  return true;
}

export function findShortcut(
  e: MinimalKeyboardEvent,
  defs: readonly ShortcutDef[] = PLAYER_SHORTCUTS,
): ShortcutDef | undefined {
  return defs.find((def) => matchesShortcut(e, def));
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * True when `target` is a form field or contenteditable element — shortcuts
 * must never hijack keystrokes someone is typing into a search box, a
 * playlist title, etc.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName)) return true;
  return Boolean(target.isContentEditable);
}
