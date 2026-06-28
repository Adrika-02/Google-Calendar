import { motion } from "framer-motion";
import { useCalendar } from "@/context/CalendarContext";
import { getColor } from "@/lib/colors";
import { eventLocalStart } from "@/lib/dateUtils";
import type { EventInstance } from "@/types/event";

interface EventChipProps {
  event: EventInstance;
  isDragSource?: boolean;
  dragHandlers?: { onPointerDown: React.PointerEventHandler<HTMLElement> };
  isLoading?: boolean;
}

export function EventChip({ event, isDragSource = false, dragHandlers, isLoading }: EventChipProps) {
  const { openDetail } = useCalendar();
  const color = getColor(event.colorId);
  const startLocal = eventLocalStart(event.startUtc, event.timezone);
  const timeLabel = event.isAllDay ? null : startLocal.toFormat("h:mm a");

  return (
    <motion.button
      role="button"
      aria-label={`${event.title}${timeLabel ? `, ${timeLabel}` : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragSource && !isLoading) openDetail(event);
      }}
      title={event.title}
      whileHover={isDragSource ? {} : { y: -1, boxShadow: "0 2px 6px rgba(0,0,0,0.22)" }}
      transition={{ duration: 0.12 }}
      onPointerDown={(e) => {
        dragHandlers?.onPointerDown(e);
      }}
      className="w-full text-left truncate rounded px-1.5 leading-5 text-xs font-medium focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-white select-none"
      style={{
        backgroundColor: color.bg,
        color: color.text,
        height: "20px",
        opacity: isDragSource ? 0.35 : 1,
        cursor: isDragSource ? "grabbing" : "grab",
      }}
    >
      {timeLabel && (
        <span className="opacity-90 font-normal mr-0.5">{timeLabel}</span>
      )}
      {event.title}
    </motion.button>
  );
}

/** Animated placeholder chip shown while events are loading */
export function SkeletonChip({ width = "75%" }: { width?: string }) {
  return (
    <motion.div
      className="rounded h-5 bg-gray-200 mx-0.5"
      style={{ width }}
      animate={{ opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
