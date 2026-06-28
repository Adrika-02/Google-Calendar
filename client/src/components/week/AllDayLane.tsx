import { useCalendar } from "@/context/CalendarContext";
import { getColor } from "@/lib/colors";
import { eventLocalStart, eventLocalEnd } from "@/lib/dateUtils";
import type { EventInstance } from "@/types/event";
import { DateTime } from "luxon";
import { ALL_DAY_ROW_HEIGHT } from "./constants";

interface AllDaySlot {
  event: EventInstance;
  startIdx: number; // 0-based index into days[]
  endIdx: number;   // 0-based index, inclusive; clamped to visible range
  row: number;
}

/**
 * Lay out all-day events in horizontal rows.
 * Longer-span events are placed first to occupy lower rows (GCal style).
 */
function layoutAllDay(events: EventInstance[], days: DateTime[]): AllDaySlot[] {
  if (!events.length || !days.length) return [];

  const firstDay = days[0]!.startOf("day");

  const slots: AllDaySlot[] = events
    .map((event) => {
      const startLocal = eventLocalStart(event.startUtc, event.timezone).startOf("day");
      const endLocal = eventLocalEnd(event.endUtc, event.timezone).startOf("day");

      const startDiff = Math.round(startLocal.diff(firstDay, "days").days);
      const endDiff = Math.round(endLocal.diff(firstDay, "days").days);

      return {
        event,
        startIdx: Math.max(0, startDiff),
        endIdx: Math.min(days.length - 1, endDiff),
        row: -1,
      };
    })
    // Drop events fully outside the visible range
    .filter((s) => s.endIdx >= 0 && s.startIdx < days.length);

  // Sort: longer spans first, then by startIdx ascending
  slots.sort((a, b) => {
    const la = a.endIdx - a.startIdx;
    const lb = b.endIdx - b.startIdx;
    return lb !== la ? lb - la : a.startIdx - b.startIdx;
  });

  // Greedy row assignment — same interval-packing principle as layoutEvents but on day axis
  const rows: Array<Array<{ startIdx: number; endIdx: number }>> = [];

  for (const slot of slots) {
    let row = -1;
    for (let r = 0; r < rows.length; r++) {
      const conflicts = rows[r]!.some(
        (e) => e.startIdx <= slot.endIdx && slot.startIdx <= e.endIdx
      );
      if (!conflicts) {
        row = r;
        break;
      }
    }
    if (row === -1) {
      row = rows.length;
      rows.push([]);
    }
    rows[row]!.push({ startIdx: slot.startIdx, endIdx: slot.endIdx });
    slot.row = row;
  }

  return slots;
}

interface AllDayLaneProps {
  days: DateTime[];
  events: EventInstance[];
}

export function AllDayLane({ days, events }: AllDayLaneProps) {
  const { openDetail } = useCalendar();
  const slots = layoutAllDay(events, days);
  const nDays = days.length;
  const maxRow = slots.reduce((m, s) => Math.max(m, s.row), -1);
  const laneHeight = Math.max(ALL_DAY_ROW_HEIGHT, (maxRow + 1) * ALL_DAY_ROW_HEIGHT);

  return (
    <div
      className="flex border-b border-gcal-border flex-shrink-0"
      style={{ minHeight: laneHeight + 4 }}
    >
      {/* Gutter label */}
      <div
        className="flex-shrink-0 flex items-start justify-end pr-2 pt-1 text-[10px] text-gcal-text-secondary"
        style={{ width: 56 }}
      >
        all-day
      </div>

      {/* Event area — relative so events can be absolutely positioned */}
      <div className="flex-1 relative" style={{ minHeight: laneHeight }}>
        {/* Day column separators */}
        {days.map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-gcal-border"
            style={{ left: `${(i / nDays) * 100}%` }}
          />
        ))}

        {/* All-day event pills */}
        {slots.map((slot) => {
          const color = getColor(slot.event.colorId);
          const leftPct = (slot.startIdx / nDays) * 100;
          const widthPct = ((slot.endIdx - slot.startIdx + 1) / nDays) * 100;

          return (
            <button
              key={`${slot.event.id}--${slot.event.originalStartUtc ?? "ad"}`}
              onClick={() => openDetail(slot.event)}
              title={slot.event.title}
              className="absolute rounded text-[11px] font-medium truncate text-left px-1.5 cursor-pointer hover:opacity-90 transition-opacity focus:outline-none"
              style={{
                top: `${slot.row * ALL_DAY_ROW_HEIGHT + 2}px`,
                left: `calc(${leftPct}% + 1px)`,
                width: `calc(${widthPct}% - 2px)`,
                height: `${ALL_DAY_ROW_HEIGHT - 2}px`,
                lineHeight: `${ALL_DAY_ROW_HEIGHT - 2}px`,
                backgroundColor: color.bg,
                color: color.text,
              }}
            >
              {slot.event.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
