import { useRef, useCallback, useState } from "react";
import { DateTime } from "luxon";
import { AnimatePresence } from "framer-motion";
import { useCalendar } from "@/context/CalendarContext";
import { useMonthEvents } from "@/api/events";
import { useUpdateEvent } from "@/api/mutations";
import { useMonthDrag, type MonthPatch } from "@/hooks/useDragResize";
import { useToast } from "@/context/ToastContext";
import { getMonthGridDays, isSameDay, eventLocalStart, eventLocalEnd } from "@/lib/dateUtils";
import { MonthDayCell } from "./MonthDayCell";
import { EditScopeDialog } from "@/components/modals/EditScopeDialog";
import type { EventInstance } from "@/types/event";
import type { EditScope } from "@/types/form";
import { DateTime as Luxon } from "luxon";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView() {
  const { selectedDate } = useCalendar();
  const { showToast } = useToast();
  const today = DateTime.now().startOf("day");
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: events = [], isPending, isError } = useMonthEvents(selectedDate);
  const updateEvent = useUpdateEvent();

  const days = getMonthGridDays(selectedDate);
  const nWeeks = days.length / 7;

  // ── Scope dialog for recurring drags ────────────────────────────────────
  const [pendingPatch, setPendingPatch] = useState<MonthPatch | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);

  const performMonthPatch = useCallback(
    async (patch: MonthPatch, scope: EditScope) => {
      const { event, newDate } = patch;
      const tz = event.timezone;

      const origStart = eventLocalStart(event.startUtc, tz);
      const origEnd = eventLocalEnd(event.endUtc, tz);
      const duration = origEnd.diff(origStart);

      // Keep same time-of-day, move to target date
      const newStart = Luxon.fromObject(
        {
          year: newDate.year,
          month: newDate.month,
          day: newDate.day,
          hour: origStart.hour,
          minute: origStart.minute,
          second: 0,
          millisecond: 0,
        },
        { zone: tz }
      );
      const newEnd = newStart.plus(duration);

      try {
        await updateEvent.mutateAsync({
          id: event.id,
          version: event.version,
          editScope: scope,
          ...(event.originalStartUtc != null && {
            originalStartUtc: event.originalStartUtc,
          }),
          startUtc: newStart.toUTC().toISO()!,
          endUtc: newEnd.toUTC().toISO()!,
          timezone: tz,
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message.includes("409") || e.message.includes("conflict")
              ? "Version conflict — another change was made to this event. Please refresh."
              : e.message
            : "Failed to save.";
        showToast(msg);
      }
    },
    [updateEvent, showToast]
  );

  const onCommit = useCallback(
    (patch: MonthPatch) => {
      if (patch.event.isRecurring) {
        setPendingPatch(patch);
        setShowScopeDialog(true);
        return;
      }
      void performMonthPatch(patch, "all");
    },
    [performMonthPatch]
  );

  const handleScopeConfirm = useCallback(
    (scope: EditScope) => {
      setShowScopeDialog(false);
      if (pendingPatch) {
        void performMonthPatch(pendingPatch, scope);
        setPendingPatch(null);
      }
    },
    [pendingPatch, performMonthPatch]
  );

  // ── Month drag hook ──────────────────────────────────────────────────────
  const { activeDrag, getChipHandlers, isDropTarget } = useMonthDrag({
    gridRef,
    days,
    onCommit,
  });

  function eventsForDay(day: DateTime): EventInstance[] {
    return events.filter((e) =>
      isSameDay(eventLocalStart(e.startUtc, e.timezone), day)
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day-of-week header row */}
      <div role="row" className="grid grid-cols-7 border-b border-gcal-border bg-white flex-shrink-0">
        {DAY_HEADERS.map((name, i) => (
          <div
            key={name}
            role="columnheader"
            aria-label={name}
            className={[
              "py-2 text-center text-xs font-medium text-gcal-text-secondary uppercase tracking-wide",
              i < 6 && "border-r border-gcal-border",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {name}
          </div>
        ))}
      </div>

      {isError && !isPending && (
        <div className="flex-shrink-0 text-center text-xs text-gcal-text-secondary py-1 bg-gray-50 border-b border-gcal-border">
          Could not load events — is the server running?
        </div>
      )}

      <div
        ref={gridRef}
        role="grid"
        aria-label={selectedDate.toFormat("MMMM yyyy")}
        className="flex-1 grid min-h-0"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: `repeat(${nWeeks}, 1fr)`,
        }}
      >
        {days.map((day, idx) => {
          const col = idx % 7;
          const row = Math.floor(idx / 7);
          return (
            <MonthDayCell
              key={day.toISODate() ?? idx}
              day={day}
              dayIdx={idx}
              events={eventsForDay(day)}
              isCurrentMonth={day.month === selectedDate.month}
              isToday={isSameDay(day, today)}
              isLastRow={row === nWeeks - 1}
              isLastCol={col === 6}
              isDropTarget={isDropTarget(idx)}
              dragSourceId={activeDrag?.event.id ?? null}
              getChipHandlers={getChipHandlers}
              isLoading={isPending}
            />
          );
        })}
      </div>

      {/* Scope dialog for recurring month drag */}
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
