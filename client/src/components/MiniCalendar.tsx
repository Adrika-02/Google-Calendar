import { useState } from "react";
import { DateTime } from "luxon";
import { useCalendar } from "@/context/CalendarContext";
import { getMonthGridDays, isSameDay } from "@/lib/dateUtils";
import { IconChevronLeft, IconChevronRight } from "./icons";

// Two-letter abbreviations matching GCal's mini-calendar
const MINI_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

export function MiniCalendar() {
  const { selectedDate, setSelectedDate } = useCalendar();
  const today = DateTime.now().startOf("day");

  // The mini-cal has its own independent month display state
  const [miniMonth, setMiniMonth] = useState<DateTime>(
    selectedDate.startOf("month")
  );

  const days = getMonthGridDays(miniMonth);

  const handleDayClick = (day: DateTime) => {
    setSelectedDate(day);
    // Keep mini-cal month in sync when user clicks across a month boundary
    if (day.month !== miniMonth.month) {
      setMiniMonth(day.startOf("month"));
    }
  };

  return (
    <div className="px-3 py-2 select-none">
      {/* Month nav header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gcal-text-primary pl-1">
          {miniMonth.toFormat("MMMM yyyy")}
        </span>
        <div className="flex items-center">
          <button
            onClick={() => setMiniMonth((m) => m.minus({ months: 1 }))}
            className="p-1 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
            aria-label="Previous month"
          >
            <IconChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMiniMonth((m) => m.plus({ months: 1 }))}
            className="p-1 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
            aria-label="Next month"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-0.5">
        {MINI_HEADERS.map((h, i) => (
          <div
            key={i}
            className="w-7 h-6 flex items-center justify-center text-[10px] font-medium text-gcal-text-secondary"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = day.month === miniMonth.month;

          let dayClass =
            "w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer";

          if (isSelected && isToday) {
            dayClass += " bg-gcal-blue text-white font-medium";
          } else if (isSelected) {
            dayClass += " bg-gcal-blue text-white";
          } else if (isToday) {
            dayClass +=
              " text-gcal-blue font-medium ring-1 ring-inset ring-gcal-blue";
          } else if (isCurrentMonth) {
            dayClass += " text-gcal-text-primary hover:bg-gray-100";
          } else {
            dayClass += " text-gcal-text-secondary hover:bg-gray-100";
          }

          return (
            <button
              key={idx}
              onClick={() => handleDayClick(day)}
              className={dayClass}
              aria-label={day.toFormat("cccc, LLLL d, yyyy")}
              aria-pressed={isSelected}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
