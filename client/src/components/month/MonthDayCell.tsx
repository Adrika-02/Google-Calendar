import type { MouseEvent } from "react";
import { DateTime } from "luxon";
import { useCalendar } from "@/context/CalendarContext";
import { isSameDay } from "@/lib/dateUtils";
import type { EventInstance } from "@/types/event";
import { EventChip, SkeletonChip } from "./EventChip";

interface MonthDayCellProps {
  day: DateTime;
  events: EventInstance[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isLastRow: boolean;
  isLastCol: boolean;
  isDropTarget?: boolean;
  dragSourceId?: string | null;
  getChipHandlers?: (
    ev: EventInstance,
    dayIdx: number
  ) => { onPointerDown: React.PointerEventHandler<HTMLElement> };
  dayIdx: number;
  isLoading?: boolean;
}

const MAX_CHIPS = 3;

// Sat=6, Sun=7 in Luxon
const isWeekendDay = (d: DateTime) => d.weekday === 6 || d.weekday === 7;

export function MonthDayCell({
  day,
  events,
  isCurrentMonth,
  isToday,
  isLastRow,
  isLastCol,
  isDropTarget = false,
  dragSourceId = null,
  getChipHandlers,
  dayIdx,
  isLoading = false,
}: MonthDayCellProps) {
  const { openCreateModal, selectedDate, setSelectedDate } = useCalendar();
  const isSelected = isSameDay(day, selectedDate);
  const isWeekend = isWeekendDay(day);

  const visible = events.slice(0, MAX_CHIPS);
  const overflow = events.length - MAX_CHIPS;

  const handleCellClick = () => {
    setSelectedDate(day);
    openCreateModal(day);
  };

  const handleDayNumberClick = (e: MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(day);
  };

  const dayNumberClass = [
    "w-7 h-7 flex items-center justify-center rounded-full text-sm leading-none select-none cursor-pointer transition-colors",
    isToday
      ? "bg-gcal-blue text-white font-medium"
      : isSelected
      ? "bg-blue-100 text-gcal-blue font-medium"
      : isCurrentMonth
      ? "text-gcal-text-primary hover:bg-gray-100"
      : "text-gcal-text-secondary hover:bg-gray-100",
  ]
    .filter(Boolean)
    .join(" ");

  const cellClass = [
    "flex flex-col min-h-0 overflow-hidden cursor-pointer group relative transition-colors",
    !isLastCol && "border-r border-gcal-border",
    !isLastRow && "border-b border-gcal-border",
    // Weekend + out-of-month shading (most specific first to avoid flicker)
    isDropTarget ? "bg-blue-50"
      : !isCurrentMonth ? "bg-gray-50"
      : isWeekend ? "bg-gray-50/60"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const eventCount = events.length;
  const ariaLabel = `${day.toFormat("MMMM d, yyyy")}${eventCount > 0 ? `, ${eventCount} event${eventCount !== 1 ? "s" : ""}` : ""}`;

  return (
    <div
      role="gridcell"
      aria-label={ariaLabel}
      className={cellClass}
      onClick={handleCellClick}
    >
      {/* Drop-target ring */}
      {isDropTarget && (
        <div className="absolute inset-0 pointer-events-none border-2 border-gcal-blue/50 z-10" />
      )}

      {/* Day number */}
      <div className="flex items-center justify-center pt-1 pb-0.5 flex-shrink-0">
        <span className={dayNumberClass} onClick={handleDayNumberClick}>
          {day.day}
        </span>
      </div>

      {/* Event chips / skeleton */}
      <div className="flex flex-col gap-px px-0.5 overflow-hidden min-h-0 flex-1 pb-1">
        {isLoading ? (
          <>
            <SkeletonChip width="80%" />
            <SkeletonChip width="60%" />
          </>
        ) : (
          <>
            {visible.map((event) => (
              <EventChip
                key={`${event.id}__${event.originalStartUtc ?? "standalone"}`}
                event={event}
                isDragSource={event.id === dragSourceId}
                dragHandlers={getChipHandlers?.(event, dayIdx)}
              />
            ))}
            {overflow > 0 && (
              <button
                className="text-left text-xs px-1.5 py-px text-gcal-text-secondary hover:text-gcal-text-primary hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                +{overflow} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
