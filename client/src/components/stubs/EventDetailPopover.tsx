import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import { useCalendar } from "@/context/CalendarContext";
import { IconX, IconPencil, IconTrash, IconClock, IconMapPin, IconRepeat } from "@/components/icons";
import { getColor } from "@/lib/colors";
import { eventLocalStart, eventLocalEnd } from "@/lib/dateUtils";
import { useDeleteWithUndo } from "@/hooks/useDeleteWithUndo";
import { EditScopeDialog } from "@/components/modals/EditScopeDialog";
import type { EditScope } from "@/types/form";

export function EventDetailPopover() {
  const { activeEvent, closeDetail, openEditModal } = useCalendar();
  const deleteWithUndo = useDeleteWithUndo();
  const [showDeleteScope, setShowDeleteScope] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (!activeEvent) return;
    const el = panelRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeDetail(); return; }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [activeEvent, closeDetail]);

  if (!activeEvent) return null;

  const color = getColor(activeEvent.colorId);
  const startLocal = eventLocalStart(activeEvent.startUtc, activeEvent.timezone);
  const endLocal   = eventLocalEnd(activeEvent.endUtc,   activeEvent.timezone);

  const dateStr = startLocal.toFormat("cccc, MMMM d");
  const yearStr = startLocal.year !== new Date().getFullYear()
    ? `, ${startLocal.year}` : "";
  const timeStr = activeEvent.isAllDay
    ? "All day"
    : `${startLocal.toFormat("h:mm a")} – ${endLocal.toFormat("h:mm a")}`;

  const handleDelete = (scope: EditScope) => {
    setShowDeleteScope(false);
    closeDetail();
    void deleteWithUndo(activeEvent, scope);
  };

  const initiateDelete = () => {
    if (activeEvent.isRecurring) {
      setShowDeleteScope(true);
    } else {
      closeDetail();
      void deleteWithUndo(activeEvent, "single");
    }
  };

  return (
    <>
      {/* Backdrop — click-away */}
      <div
        className="fixed inset-0 z-[55]"
        onClick={closeDetail}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="fixed inset-0 z-[56] flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label={activeEvent.title}
      >
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="pointer-events-auto bg-white rounded-xl shadow-2xl w-80 overflow-hidden flex"
          style={{ border: "1px solid #dadce0" }}
        >
          {/* Colored left border — 4px, GCal-style */}
          <div className="w-1 flex-shrink-0" style={{ backgroundColor: color.bg }} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-end gap-0.5 px-2 pt-2">
              <button
                onClick={() => { closeDetail(); openEditModal(activeEvent); }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
                aria-label="Edit event"
                title="Edit event"
              >
                <IconPencil size={16} />
              </button>
              <button
                onClick={initiateDelete}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
                aria-label="Delete event"
                title="Delete event"
              >
                <IconTrash size={16} />
              </button>
              <button
                onClick={closeDetail}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
                aria-label="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pt-2 pb-5 flex flex-col gap-3">
              {/* Color dot + title */}
              <div className="flex items-start gap-2">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: color.bg }}
                  aria-hidden="true"
                />
                <h3 className="text-lg font-medium text-gcal-text-primary leading-snug">
                  {activeEvent.title}
                </h3>
              </div>

              {/* Date + time */}
              <div className="flex items-start gap-3 text-sm">
                <IconClock size={16} className="text-gcal-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gcal-text-primary">
                    {dateStr}{yearStr}
                  </p>
                  <p className="text-gcal-text-secondary">{timeStr}</p>
                </div>
              </div>

              {/* Recurring */}
              {activeEvent.isRecurring && (
                <div className="flex items-center gap-3 text-sm">
                  <IconRepeat size={16} className="text-gcal-text-secondary flex-shrink-0" />
                  <p className="text-gcal-text-secondary">Recurring event</p>
                </div>
              )}

              {/* Location */}
              {activeEvent.location && (
                <div className="flex items-start gap-3 text-sm">
                  <IconMapPin size={16} className="text-gcal-text-secondary mt-0.5 flex-shrink-0" />
                  <p className="text-gcal-text-primary">{activeEvent.location}</p>
                </div>
              )}

              {/* Description */}
              {activeEvent.description && (
                <p className="text-sm text-gcal-text-secondary leading-relaxed pl-7">
                  {activeEvent.description}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recurring delete scope */}
      <AnimatePresence>
        {showDeleteScope && (
          <EditScopeDialog
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteScope(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
