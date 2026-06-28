import { useState, useEffect } from "react";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import { HOUR_HEIGHT } from "./constants";

export function NowLine() {
  const [now, setNow] = useState(DateTime.now());

  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const top = ((now.hour * 60 + now.minute) / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute inset-x-0 pointer-events-none z-20 flex items-center"
      style={{ top: `${top}px` }}
    >
      {/* Pulsing dot */}
      <motion.div
        className="w-2.5 h-2.5 rounded-full bg-gcal-red flex-shrink-0 -ml-1.5"
        animate={{ scale: [1, 1.35, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
      />
      {/* Line */}
      <div className="flex-1 bg-gcal-red" style={{ height: "1.5px" }} />
    </div>
  );
}
