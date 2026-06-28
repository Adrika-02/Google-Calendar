import { useCalendar } from "@/context/CalendarContext";
import { getColor } from "@/lib/colors";
import { eventLocalStart, eventLocalEnd, isSameDay } from "@/lib/dateUtils";
import type { EventInstance } from "@/types/event";
import { HOUR_HEIGHT, MIN_EVENT_MINUTES } from "./constants";

interface TimeEventProps {
  event: EventInstance;
  col: number;
  totalCols: number;
  /** Provided by WeekView when this event is being moved */
  isDragging?: boolean;
  /** Provided by WeekView when this event is being resized */
  isResizing?: boolean;
  moveHandlers?: { onPointerDown: React.PointerEventHandler<HTMLElement> };
  resizeHandlers?: { onPointerDown: React.PointerEventHandler<HTMLElement> };
}

function fmtMins(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  const period = h < 12 ? "AM" : "PM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(min).padStart(2, "0")} ${period}`;
}

export function TimeEvent({
  event,
  col,
  totalCols,
  isDragging = false,
  isResizing = false,
  moveHandlers,
  resizeHandlers,
}: TimeEventProps) {
  const { openDetail } = useCalendar();
  const color = getColor(event.colorId);

  const startLocal = eventLocalStart(event.startUtc, event.timezone);
  const endLocal = eventLocalEnd(event.endUtc, event.timezone);

  const startMinutes = startLocal.hour * 60 + startLocal.minute;
  const rawEndMinutes = isSameDay(startLocal, endLocal)
    ? endLocal.hour * 60 + endLocal.minute
    : 24 * 60;
  const durationMinutes = Math.max(rawEndMinutes - startMinutes, MIN_EVENT_MINUTES);

  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const height = (durationMinutes / 60) * HOUR_HEIGHT;

  const leftPct = (col / totalCols) * 100;
  const widthPct = (1 / totalCols) * 100;

  const timeStr = startLocal.toFormat("h:mm a");
  const isShort = height < 30;

  // During a move drag, dim and disable pointer events on the source
  const isBeingDragged = isDragging && !isResizing;

  return (
    <div
      data-event-draggable="true"
      data-event-id={event.id}
      onClick={isBeingDragged ? undefined : () => openDetail(event)}
      {...(moveHandlers && !isDragging && !isResizing ? moveHandlers : {})}
      style={{
        position: "absolute",
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
        backgroundColor: color.bg,
        color: color.text,
        zIndex: isResizing ? 20 : 10,
        opacity: isBeingDragged ? 0.3 : 1,
        pointerEvents: isBeingDragged ? "none" : "auto",
        cursor: isDragging || isResizing ? "default" : "grab",
        transition: isDragging || isResizing ? "none" : "opacity 0.1s",
      }}
      className="rounded overflow-hidden select-none"
    >
      {/* Event content */}
      <div className="px-1.5 py-0.5 h-full overflow-hidden">
        <p className="text-[11px] font-semibold leading-tight truncate">
          {event.title}
        </p>
        {!isShort && (
          <p className="text-[10px] opacity-85 truncate leading-tight">{timeStr}</p>
        )}
        {/* Resize end-time label shown during resize */}
        {isResizing && (
          <p className="text-[10px] opacity-90 leading-tight font-medium mt-auto pt-1">
            {fmtMins(startMinutes + durationMinutes)}
          </p>
        )}
      </div>

      {/* Resize handle — bottom 8px strip with resize cursor */}
      {!isBeingDragged && (
        <div
          {...resizeHandlers}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "8px",
            cursor: "ns-resize",
          }}
          className="flex items-center justify-center"
          title="Drag to resize"
        >
          {/* Visual grip dots */}
          <div
            className="w-6 h-0.5 rounded-full opacity-50"
            style={{ backgroundColor: color.text }}
          />
        </div>
      )}
    </div>
  );
}
