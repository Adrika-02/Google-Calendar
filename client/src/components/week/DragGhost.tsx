import { DateTime } from "luxon";
import { getColor } from "@/lib/colors";
import type { ActiveWeekDrag } from "@/hooks/useDragResize";
import { GUTTER_WIDTH, HOUR_HEIGHT } from "./constants";

interface DragGhostProps {
  drag: ActiveWeekDrag;
  days: DateTime[];
  gridWidth: number; // clientWidth of the grid container, cached by parent
}

function fmtMins(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  const period = h < 12 ? "AM" : "PM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(min).padStart(2, "0")} ${period}`;
}

export function DragGhost({ drag, days, gridWidth }: DragGhostProps) {
  const { event, mode, targetDayIdx, targetStartMins, targetDurMins } = drag;
  const color = getColor(event.colorId);
  const nDays = days.length;

  const colWidth = (gridWidth - GUTTER_WIDTH) / nDays;
  const left = GUTTER_WIDTH + targetDayIdx * colWidth;
  const top = (targetStartMins / 60) * HOUR_HEIGHT;
  const height = (targetDurMins / 60) * HOUR_HEIGHT;

  // Don't show ghost for resize — element height is updated directly
  if (mode === "resize") return null;

  const endMins = targetStartMins + targetDurMins;

  return (
    <div
      className="absolute pointer-events-none rounded z-30"
      style={{
        top,
        left,
        width: colWidth - 2,
        height: Math.max(height, 20),
        backgroundColor: color.bg,
        opacity: 0.85,
        outline: `2px solid ${color.bg}`,
        outlineOffset: "1px",
      }}
    >
      <div className="px-1.5 py-0.5 overflow-hidden h-full">
        <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: color.text }}>
          {event.title}
        </p>
        {height >= 28 && (
          <p className="text-[10px] opacity-85 leading-tight" style={{ color: color.text }}>
            {fmtMins(targetStartMins)} – {fmtMins(endMins)}
          </p>
        )}
      </div>
    </div>
  );
}
