import { useEffect, useCallback } from "react";

export type ShortcutAction =
  | "today"
  | "month"
  | "week"
  | "day"
  | "create"
  | "shortcuts"
  | "close"
  | "prev"
  | "next";

const KEY_MAP: Record<string, ShortcutAction> = {
  t: "today",
  m: "month",
  w: "week",
  d: "day",
  c: "create",
  "?": "shortcuts",
  Escape: "close",
  ArrowLeft: "prev",
  ArrowRight: "next",
};

export const SHORTCUT_LABELS: { action: ShortcutAction; key: string; description: string }[] = [
  { action: "today",     key: "T",   description: "Go to today" },
  { action: "month",     key: "M",   description: "Month view" },
  { action: "week",      key: "W",   description: "Week view" },
  { action: "day",       key: "D",   description: "Day view" },
  { action: "prev",      key: "←",   description: "Previous period" },
  { action: "next",      key: "→",   description: "Next period" },
  { action: "create",    key: "C",   description: "Create event" },
  { action: "close",     key: "Esc", description: "Close / Cancel" },
  { action: "shortcuts", key: "?",   description: "Show keyboard shortcuts" },
];

interface UseKeyboardShortcutsOptions {
  onAction: (action: ShortcutAction) => void;
  /** Set true to disable shortcuts (e.g. when a modal is open and handles Esc itself) */
  disabled?: boolean;
}

export function useKeyboardShortcuts({ onAction, disabled }: UseKeyboardShortcutsOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      // Don't intercept when typing in form fields
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const action = KEY_MAP[e.key];
      if (action) {
        e.preventDefault();
        onAction(action);
      }
    },
    [onAction, disabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
