import { memo } from "react";
import { DateTime } from "luxon";
import { layoutEvents } from "@/lib/layoutEvents";
import { eventLocalStart, eventLocalEnd, isSameDay } from "@/lib/dateUtils";
import type { EventInstance } from "@/types/event";
import { TimeEvent } from "./TimeEvent";
import { NowLine } from "./NowLine";
import { HOUR_HEIGHT, MIN_EVENT_MINUTES, TOTAL_HEIGHT } from "./constants";

interface TimedInput {
  id: string;
  startMinutes: number;
  endMinutes: number;
  _event: EventInstance;
}

interface DayColumnProps {
  day: DateTime;
  events: EventInstance[];
  isToday: boolean;
  isDropTarget?: boolean;
  draggingEventId?: string | null;
  resizingEventId?: string | null;
  getMoveHandlers?: (ev: EventInstance, dayIdx: number, startMins: number, durMins: number) =>
    { onPointerDown: React.PointerEventHandler<HTMLElement> };
  getResizeHandlers?: (ev: EventInstance, dayIdx: number, startMins: number, durMins: number) =>
    { onPointerDown: React.PointerEventHandler<HTMLElement> };
  dayIdx: number;
}

export const DayColumn = memo(function DayColumn({
  day,
  events,
  isToday,
  isDropTarget = false,
  draggingEventId = null,
  resizingEventId = null,
  getMoveHandlers,
  getResizeHandlers,
  dayIdx,
}: DayColumnProps) {
  const inputs: TimedInput[] = events.map((e) => {
    const start = eventLocalStart(e.startUtc, e.timezone);
    const end = eventLocalEnd(e.endUtc, e.timezone);
    const startMins = start.hour * 60 + start.minute;
    const rawEnd = isSameDay(start, end) ? end.hour * 60 + end.minute : 24 * 60;
    return {
      id: `${e.id}__${e.originalStartUtc ?? "s"}`,
      startMinutes: startMins,
      endMinutes: Math.max(rawEnd, startMins + MIN_EVENT_MINUTES),
      _event: e,
    };
  });

  const laid = layoutEvents<TimedInput>(inputs);

  return (
    <div
      className={[
        "flex-1 relative border-l border-gcal-border overflow-hidden transition-colors",
        isDropTarget ? "bg-blue-50/50"
          : isToday ? "bg-blue-50/20"
          : (day.weekday === 6 || day.weekday === 7) ? "bg-gray-50/50"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height: TOTAL_HEIGHT }}
    >
      {/* Drop-target highlight overlay */}
      {isDropTarget && (
        <div className="absolute inset-0 pointer-events-none border-2 border-gcal-blue/40 z-20 rounded-sm" />
      )}

      {/* Hour grid lines */}
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-b border-gcal-border pointer-events-none"
          style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
        >
          <div
            className="absolute inset-x-0 border-t border-gcal-border opacity-40"
            style={{ borderStyle: "dashed", top: "50%" }}
          />
        </div>
      ))}

      {/* Timed events */}
      {laid.map(({ event: input, col, totalCols }) => {
        const ev = input._event;
        const start = eventLocalStart(ev.startUtc, ev.timezone);
        const end = eventLocalEnd(ev.endUtc, ev.timezone);
        const startMins = start.hour * 60 + start.minute;
        const rawEnd = isSameDay(start, end) ? end.hour * 60 + end.minute : 24 * 60;
        const durMins = Math.max(rawEnd - startMins, MIN_EVENT_MINUTES);

        return (
          <TimeEvent
            key={input.id}
            event={ev}
            col={col}
            totalCols={totalCols}
            isDragging={ev.id === draggingEventId}
            isResizing={ev.id === resizingEventId}
            moveHandlers={getMoveHandlers?.(ev, dayIdx, startMins, durMins)}
            resizeHandlers={getResizeHandlers?.(ev, dayIdx, startMins, durMins)}
          />
        );
      })}

      {isToday && <NowLine />}

      {isToday && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gcal-blue pointer-events-none z-10" />
      )}
    </div>
  );
});
