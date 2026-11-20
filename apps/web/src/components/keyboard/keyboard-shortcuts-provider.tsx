"use client";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useUiStore } from "@/store/ui-store";
import { ShortcutsHelpDialog } from "./shortcuts-help-dialog";

/** Sits once near the root layout — see app/layout.tsx. */
export function KeyboardShortcutsProvider() {
  useKeyboardShortcuts();
  const open = useUiStore((s) => s.shortcutsHelpOpen);
  const close = useUiStore((s) => s.closeShortcutsHelp);

  if (!open) return null;
  return <ShortcutsHelpDialog onClose={close} />;
}
