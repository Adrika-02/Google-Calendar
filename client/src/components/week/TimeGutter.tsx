import { HOUR_HEIGHT, TOTAL_HEIGHT } from "./constants";

// "12 AM" … "11 AM" … "12 PM" … "11 PM"
function hourLabel(h: number): string {
  if (h === 0) return ""; // midnight — suppress to reduce clutter
  const meridiem = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${meridiem}`;
}

/**
 * Left-side time labels. Positioned absolutely at each hour mark.
 * Labels are offset upward by ~9px so their baseline sits on the hour line.
 */
export function TimeGutter() {
  return (
    <div
      className="flex-shrink-0 relative select-none"
      style={{ width: 56, height: TOTAL_HEIGHT }}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="absolute right-2 text-[10px] leading-none text-gcal-text-secondary"
          style={{ top: `${h * HOUR_HEIGHT - 7}px` }}
        >
          {hourLabel(h)}
        </div>
      ))}
    </div>
  );
}
