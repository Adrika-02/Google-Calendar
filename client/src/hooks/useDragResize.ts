import { useRef, useState, useCallback } from "react";
import { DateTime } from "luxon";
import type { EventInstance } from "@/types/event";
import { GUTTER_WIDTH, HOUR_HEIGHT } from "@/components/week/constants";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type DragPatch =
  | { kind: "move";   event: EventInstance; newStartUtc: string; newEndUtc: string }
  | { kind: "resize"; event: EventInstance; newEndUtc: string };

export type MonthPatch = { event: EventInstance; newDate: DateTime };

export interface ActiveWeekDrag {
  event: EventInstance;
  mode: "move" | "resize";
  sourceDayIdx: number;
  sourceStartMins: number;
  sourceDurMins: number;
  /** Updated 60fps via RAF — drives ghost rendering */
  targetDayIdx: number;
  targetStartMins: number;
  targetDurMins: number;
}

// ─── Internal ref state (not React state — no re-render on pointermove) ──────

interface InternalDrag {
  event: EventInstance;
  mode: "move" | "resize";
  dayIdx: number;
  startMins: number;
  durMins: number;
  pointerStartX: number;
  pointerStartY: number;
  /** Snapshot taken on pointerdown — no layout reads inside RAF */
  gridRect: { left: number; top: number; width: number };
  colCount: number;
  /** For resize: the event container DOM node whose height we update directly */
  element: HTMLElement | null;
  rafId: number | null;
  /** Current snapped target, read by pointerup to compute UTCs */
  curDayIdx: number;
  curStartMins: number;
  curDurMins: number;
  /** True once the pointer has moved past the drag-start threshold */
  dragStarted: boolean;
}

const DRAG_THRESHOLD_PX = 5;

// ─── Snap helper ──────────────────────────────────────────────────────────────

function snapTo(v: number, grid: number) {
  return Math.round(v / grid) * grid;
}

// ─── useWeekDragResize ────────────────────────────────────────────────────────

interface WeekDragOptions {
  gridRef: React.RefObject<HTMLDivElement | null>;
  days: DateTime[];
  hourHeight?: number;
  snapMinutes?: number;
  onCommit: (patch: DragPatch) => void;
}

export function useWeekDragResize({
  gridRef,
  days,
  hourHeight = HOUR_HEIGHT,
  snapMinutes = 15,
  onCommit,
}: WeekDragOptions) {
  const internalRef = useRef<InternalDrag | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveWeekDrag | null>(null);

  // ── Move handler factory ─────────────────────────────────────────────────

  const getMoveHandlers = useCallback(
    (ev: EventInstance, dayIdx: number, startMins: number, durMins: number) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        // Do NOT call e.preventDefault() — it would suppress the click event
        // that opens the detail popover on a tap. CSS select-none handles text selection.
        e.stopPropagation();

        const grid = gridRef.current;
        if (!grid) return;
        const rect = grid.getBoundingClientRect();

        internalRef.current = {
          event: ev, mode: "move", dayIdx, startMins, durMins,
          pointerStartX: e.clientX, pointerStartY: e.clientY,
          gridRect: { left: rect.left, top: rect.top, width: rect.width },
          colCount: days.length, element: null, rafId: null,
          curDayIdx: dayIdx, curStartMins: startMins, curDurMins: durMins,
          dragStarted: false,
        };

        // Do NOT call setActiveDrag here — doing so would immediately set
        // isBeingDragged=true and clear onClick before the click fires.
        // activeDrag is set only once the pointer moves past DRAG_THRESHOLD_PX.

        const handleMove = (pe: PointerEvent) => {
          const d = internalRef.current;
          if (!d) return;

          // Activate drag only after threshold is crossed
          if (!d.dragStarted) {
            const dist = Math.hypot(pe.clientX - d.pointerStartX, pe.clientY - d.pointerStartY);
            if (dist < DRAG_THRESHOLD_PX) return;
            d.dragStarted = true;
            document.body.style.cursor = "grabbing";
            setActiveDrag({
              event: ev, mode: "move",
              sourceDayIdx: dayIdx, sourceStartMins: startMins, sourceDurMins: durMins,
              targetDayIdx: dayIdx, targetStartMins: startMins, targetDurMins: durMins,
            });
          }

          if (d.rafId !== null) cancelAnimationFrame(d.rafId);
          d.rafId = requestAnimationFrame(() => {
            if (!internalRef.current) return;
            d.rafId = null;

            const colWidth = (d.gridRect.width - GUTTER_WIDTH) / d.colCount;
            const dX = pe.clientX - d.pointerStartX;
            const dY = pe.clientY - d.pointerStartY;

            const deltaDays = Math.round(dX / colWidth);
            const newDay = Math.max(0, Math.min(d.colCount - 1, d.dayIdx + deltaDays));
            const rawStart = d.startMins + (dY / hourHeight) * 60;
            const newStart = Math.max(0, Math.min(23 * 60, snapTo(rawStart, snapMinutes)));

            d.curDayIdx = newDay;
            d.curStartMins = newStart;

            setActiveDrag((prev) =>
              prev ? { ...prev, targetDayIdx: newDay, targetStartMins: newStart } : prev
            );
          });
        };

        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          const d = internalRef.current;
          if (!d) return;
          if (d.rafId !== null) cancelAnimationFrame(d.rafId);
          document.body.style.cursor = "";
          internalRef.current = null;
          setActiveDrag(null);

          // If drag never started (tap), let the onClick handler open the detail
          if (!d.dragStarted) return;

          if (d.curDayIdx === d.dayIdx && d.curStartMins === d.startMins) return;

          const targetDay = days[d.curDayIdx];
          if (!targetDay) return;
          const tz = ev.timezone;
          const dateStr = targetDay.toFormat("yyyy-MM-dd");
          const newStartUtc = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: tz })
            .plus({ minutes: d.curStartMins })
            .toUTC().toISO()!;
          const newEndUtc = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: tz })
            .plus({ minutes: d.curStartMins + d.durMins })
            .toUTC().toISO()!;

          onCommit({ kind: "move", event: ev, newStartUtc, newEndUtc });
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp, { once: true });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridRef, days, hourHeight, snapMinutes, onCommit]
  );

  // ── Resize handler factory ───────────────────────────────────────────────

  const getResizeHandlers = useCallback(
    (ev: EventInstance, dayIdx: number, startMins: number, durMins: number) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        const grid = gridRef.current;
        if (!grid) return;
        const rect = grid.getBoundingClientRect();

        // Grab the event container element (has data-event-draggable attribute)
        const eventEl = e.currentTarget.closest<HTMLElement>("[data-event-draggable]");

        internalRef.current = {
          event: ev, mode: "resize", dayIdx, startMins, durMins,
          pointerStartX: e.clientX, pointerStartY: e.clientY,
          gridRect: { left: rect.left, top: rect.top, width: rect.width },
          colCount: days.length, element: eventEl, rafId: null,
          curDayIdx: dayIdx, curStartMins: startMins, curDurMins: durMins,
          dragStarted: true,
        };

        setActiveDrag({
          event: ev, mode: "resize",
          sourceDayIdx: dayIdx, sourceStartMins: startMins, sourceDurMins: durMins,
          targetDayIdx: dayIdx, targetStartMins: startMins, targetDurMins: durMins,
        });

        document.body.style.cursor = "ns-resize";

        const handleMove = (pe: PointerEvent) => {
          const d = internalRef.current;
          if (!d) return;
          if (d.rafId !== null) cancelAnimationFrame(d.rafId);
          d.rafId = requestAnimationFrame(() => {
            if (!internalRef.current) return;
            d.rafId = null;

            const dY = pe.clientY - d.pointerStartY;
            const rawDur = d.durMins + (dY / hourHeight) * 60;
            const maxDur = 24 * 60 - d.startMins;
            const newDur = Math.max(snapMinutes, Math.min(maxDur, snapTo(rawDur, snapMinutes)));

            d.curDurMins = newDur;

            // Direct DOM write — no React reconcile for the height change
            if (d.element) {
              d.element.style.height = `${(newDur / 60) * hourHeight}px`;
            }

            // React state only for the end-time label in the ghost
            setActiveDrag((prev) =>
              prev ? { ...prev, targetDurMins: newDur } : prev
            );
          });
        };

        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          const d = internalRef.current;
          if (!d) return;
          if (d.rafId !== null) cancelAnimationFrame(d.rafId);
          if (d.element) d.element.style.height = ""; // reset; React will re-render correct height
          document.body.style.cursor = "";
          internalRef.current = null;
          setActiveDrag(null);

          if (d.curDurMins === d.durMins) return;

          const tz = ev.timezone;
          const dateStr = days[d.dayIdx]?.toFormat("yyyy-MM-dd");
          if (!dateStr) return;
          const newEndUtc = DateTime.fromISO(`${dateStr}T00:00:00`, { zone: tz })
            .plus({ minutes: d.startMins + d.curDurMins })
            .toUTC().toISO()!;

          onCommit({ kind: "resize", event: ev, newEndUtc });
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp, { once: true });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridRef, days, hourHeight, snapMinutes, onCommit]
  );

  const isDropTarget = useCallback(
    (dayIdx: number) =>
      activeDrag?.mode === "move" && activeDrag.targetDayIdx === dayIdx,
    [activeDrag]
  );

  return { activeDrag, getMoveHandlers, getResizeHandlers, isDropTarget };
}

// ─── useMonthDrag ─────────────────────────────────────────────────────────────

interface MonthDragOptions {
  gridRef: React.RefObject<HTMLDivElement | null>;
  days: DateTime[];
  onCommit: (patch: MonthPatch) => void;
}

interface MonthInternalDrag {
  event: EventInstance;
  sourceDayIdx: number;
  pointerStartX: number;
  pointerStartY: number;
  /** Snapshot so RAF does no layout reads */
  gridRect: { left: number; top: number; width: number; height: number };
  nRows: number;
  rafId: number | null;
  curDayIdx: number;
}

interface ActiveMonthDrag {
  event: EventInstance;
  sourceDayIdx: number;
}

export function useMonthDrag({ gridRef, days, onCommit }: MonthDragOptions) {
  const internalRef = useRef<MonthInternalDrag | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveMonthDrag | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  const getChipHandlers = useCallback(
    (ev: EventInstance, dayIdx: number) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const grid = gridRef.current;
        if (!grid) return;
        const rect = grid.getBoundingClientRect();
        const nRows = Math.ceil(days.length / 7);

        internalRef.current = {
          event: ev, sourceDayIdx: dayIdx,
          pointerStartX: e.clientX, pointerStartY: e.clientY,
          gridRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          nRows, rafId: null, curDayIdx: dayIdx,
        };

        setActiveDrag({ event: ev, sourceDayIdx: dayIdx });
        setDropTargetIdx(dayIdx);
        document.body.style.cursor = "grabbing";

        const handleMove = (pe: PointerEvent) => {
          const d = internalRef.current;
          if (!d) return;
          if (d.rafId !== null) cancelAnimationFrame(d.rafId);
          d.rafId = requestAnimationFrame(() => {
            if (!internalRef.current) return;
            d.rafId = null;

            const { gridRect, nRows: nr } = d;
            const colW = gridRect.width / 7;
            const rowH = gridRect.height / nr;

            const col = Math.floor((pe.clientX - gridRect.left) / colW);
            const row = Math.floor((pe.clientY - gridRect.top) / rowH);

            if (col < 0 || col > 6 || row < 0 || row >= nr) return;

            const newIdx = row * 7 + col;
            if (newIdx < 0 || newIdx >= days.length) return;

            d.curDayIdx = newIdx;
            setDropTargetIdx(newIdx);
          });
        };

        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          const d = internalRef.current;
          if (!d) return;
          if (d.rafId !== null) cancelAnimationFrame(d.rafId);
          document.body.style.cursor = "";
          internalRef.current = null;
          setActiveDrag(null);
          setDropTargetIdx(null);

          const newDate = days[d.curDayIdx];
          if (!newDate || d.curDayIdx === d.sourceDayIdx) return;

          onCommit({ event: ev, newDate });
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp, { once: true });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridRef, days, onCommit]
  );

  const isDropTarget = useCallback(
    (dayIdx: number) => dropTargetIdx === dayIdx,
    [dropTargetIdx]
  );

  return { activeDrag, getChipHandlers, isDropTarget };
}
