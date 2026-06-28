import { useRef, useEffect, useState, useCallback } from "react";
import { DateTime } from "luxon";
import { AnimatePresence } from "framer-motion";
import { useRangeEvents } from "@/api/events";
import { useUpdateEvent } from "@/api/mutations";
import { useWeekDragResize, type DragPatch } from "@/hooks/useDragResize";
import { useToast } from "@/context/ToastContext";
import { isSameDay, eventLocalStart, eventLocalEnd } from "@/lib/dateUtils";
import type { EventInstance } from "@/types/event";
import type { EditScope } from "@/types/form";
import { TimeGutter } from "./TimeGutter";
import { DayColumn } from "./DayColumn";
import { AllDayLane } from "./AllDayLane";
import { DragGhost } from "./DragGhost";
import { HOUR_HEIGHT, GUTTER_WIDTH } from "./constants";
import { useCalendar } from "@/context/CalendarContext";
import { EditScopeDialog } from "@/components/modals/EditScopeDialog";

const DAY_ABBREVS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function isAllDayLane(event: EventInstance): boolean {
  if (event.isAllDay) return true;
  const start = eventLocalStart(event.startUtc, event.timezone);
  const end = eventLocalEnd(event.endUtc, event.timezone);
  return !isSameDay(start, end);
}

function timedEventsForDay(events: EventInstance[], day: DateTime): EventInstance[] {
  return events.filter(
    (e) => !isAllDayLane(e) && isSameDay(eventLocalStart(e.startUtc, e.timezone), day)
  );
}

interface WeekViewProps {
  days: DateTime[];
}

export function WeekView({ days }: WeekViewProps) {
  const { openCreateModal } = useCalendar();
  const { showToast } = useToast();
  const today = DateTime.now().startOf("day");
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridInnerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const { data: events = [], isError } = useRangeEvents(days[0]!, days[days.length - 1]!);
  const updateEvent = useUpdateEvent();

  // ── Scope dialog for recurring drag ─────────────────────────────────────
  const [pendingPatch, setPendingPatch] = useState<DragPatch | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);

  const performPatch = useCallback(
    async (patch: DragPatch, scope: EditScope) => {
      try {
        const payload =
          patch.kind === "move"
            ? {
                id: patch.event.id,
                version: patch.event.version,
                editScope: scope,
                ...(patch.event.originalStartUtc != null && {
                  originalStartUtc: patch.event.originalStartUtc,
                }),
                startUtc: patch.newStartUtc,
                endUtc: patch.newEndUtc,
                timezone: patch.event.timezone,
              }
            : {
                id: patch.event.id,
                version: patch.event.version,
                editScope: scope,
                ...(patch.event.originalStartUtc != null && {
                  originalStartUtc: patch.event.originalStartUtc,
                }),
                endUtc: patch.newEndUtc,
              };
        await updateEvent.mutateAsync(payload);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message.includes("409") || e.message.includes("conflict")
              ? "Version conflict — another change was made to this event. Please refresh."
              : e.message
            : "Failed to save. Please try again.";
        showToast(msg);
      }
    },
    [updateEvent, showToast]
  );

  const onCommit = useCallback(
    (patch: DragPatch) => {
      if (patch.event.isRecurring) {
        setPendingPatch(patch);
        setShowScopeDialog(true);
        return;
      }
      void performPatch(patch, patch.event.isRecurring ? "single" : "all");
    },
    [performPatch]
  );

  const handleScopeConfirm = useCallback(
    (scope: EditScope) => {
      setShowScopeDialog(false);
      if (pendingPatch) {
        void performPatch(pendingPatch, scope);
        setPendingPatch(null);
      }
    },
    [pendingPatch, performPatch]
  );

  // ── Drag hook ─────────────────────────────────────────────────────────────
  const { activeDrag, getMoveHandlers, getResizeHandlers, isDropTarget } =
    useWeekDragResize({ gridRef: scrollRef, days, onCommit });

  // Measure grid width for ghost positioning
  useEffect(() => {
    const el = gridInnerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setGridWidth(el.clientWidth));
    obs.observe(el);
    setGridWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  // Scroll to 7 AM on first mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allDayEvents = events.filter(isAllDayLane);
  const timedEvents = events.filter((e) => !isAllDayLane(e));

  const draggingEventId =
    activeDrag?.mode === "move" ? activeDrag.event.id : null;
  const resizingEventId =
    activeDrag?.mode === "resize" ? activeDrag.event.id : null;

  return (
    <div className="flex flex-col h-full">
      {/* Day header row */}
      <div
        className="flex flex-shrink-0 border-b border-gcal-border bg-white z-10"
        style={{ paddingLeft: GUTTER_WIDTH }}
      >
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const abbrev = DAY_ABBREVS[day.weekday % 7] ?? "";
          return (
            <div
              key={day.toISODate() ?? day.toMillis()}
              className="flex-1 flex flex-col items-center py-2"
            >
              <span
                className={[
                  "text-[11px] font-medium tracking-wide uppercase",
                  isToday ? "text-gcal-blue" : "text-gcal-text-secondary",
                ].join(" ")}
              >
                {abbrev}
              </span>
              <button
                onClick={() => openCreateModal(day)}
                className={[
                  "w-9 h-9 rounded-full flex items-center justify-center text-2xl font-light transition-colors mt-0.5",
                  isToday
                    ? "bg-gcal-blue text-white"
                    : "text-gcal-text-primary hover:bg-gray-100",
                ].join(" ")}
              >
                {day.day}
              </button>
            </div>
          );
        })}
      </div>

      <AllDayLane days={days} events={allDayEvents} />

      {isError && (
        <div className="flex-shrink-0 text-center text-xs text-gcal-text-secondary py-1 bg-gray-50 border-b border-gcal-border">
          Could not load events — is the server running?
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div ref={gridInnerRef} className="flex relative">
          <TimeGutter />

          {days.map((day, dayIdx) => (
            <DayColumn
              key={day.toISODate() ?? day.toMillis()}
              day={day}
              dayIdx={dayIdx}
              events={timedEventsForDay(timedEvents, day)}
              isToday={isSameDay(day, today)}
              isDropTarget={isDropTarget(dayIdx)}
              draggingEventId={draggingEventId}
              resizingEventId={resizingEventId}
              getMoveHandlers={getMoveHandlers}
              getResizeHandlers={getResizeHandlers}
            />
          ))}

          {/* Drag ghost — positioned absolutely inside the inner grid */}
          {activeDrag && activeDrag.mode === "move" && gridWidth > 0 && (
            <DragGhost drag={activeDrag} days={days} gridWidth={gridWidth} />
          )}
        </div>
      </div>

      {/* Edit-scope dialog for recurring drags */}
      <AnimatePresence>
        {showScopeDialog && (
          <EditScopeDialog
            onConfirm={handleScopeConfirm}
            onCancel={() => {
              setShowScopeDialog(false);
              setPendingPatch(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
