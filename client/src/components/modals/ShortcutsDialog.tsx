import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { SHORTCUT_LABELS } from "@/hooks/useKeyboardShortcuts";
import { IconX } from "@/components/icons";

interface Props {
  onClose: () => void;
}

export function ShortcutsDialog({ onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [onClose]);

  const groups = [
    { label: "Navigation", actions: ["today", "month", "week", "day", "prev", "next"] },
    { label: "Events",     actions: ["create", "close", "shortcuts"] },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gcal-border">
          <h2 className="text-base font-medium text-gcal-text-primary">
            Keyboard shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gcal-text-secondary mb-2">
                {g.label}
              </p>
              <div className="flex flex-col gap-1.5">
                {SHORTCUT_LABELS.filter((s) => g.actions.includes(s.action)).map((s) => (
                  <div key={s.action} className="flex items-center justify-between">
                    <span className="text-sm text-gcal-text-primary">{s.description}</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gcal-text-secondary border border-gcal-border rounded">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
