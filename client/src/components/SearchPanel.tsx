import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { motion, AnimatePresence } from "framer-motion";
import type { EventInstance } from "@/types/event";
import { eventLocalStart } from "@/lib/dateUtils";
import { getColor } from "@/lib/colors";
import { IconX } from "./icons";

interface SearchPanelProps {
  onClose: () => void;
  onNavigate: (date: DateTime, event: EventInstance) => void;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-gcal-text-primary rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SearchPanel({ onClose, onNavigate }: SearchPanelProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const results = useCallback((): EventInstance[] => {
    if (query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();

    // Collect all events from every TQ cache entry
    const allCached = qc.getQueriesData<EventInstance[]>({ queryKey: ["events"] });
    const seen = new Set<string>();
    const events: EventInstance[] = [];

    for (const [, data] of allCached) {
      if (!data) continue;
      for (const e of data) {
        const key = `${e.id}-${e.originalStartUtc ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q)
        ) {
          events.push(e);
        }
      }
    }

    return events
      .sort((a, b) => new Date(b.startUtc).getTime() - new Date(a.startUtc).getTime())
      .slice(0, 20);
  }, [query, qc])();

  return (
    <div ref={panelRef} className="absolute top-full left-0 right-0 mt-1 z-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl border border-gcal-border overflow-hidden max-w-xl mx-auto"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gcal-border">
          <svg className="w-4 h-4 text-gcal-text-secondary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm text-gcal-text-primary placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gcal-text-secondary hover:text-gcal-text-primary transition-colors">
              <IconX size={16} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="text-xs text-gcal-text-secondary text-center py-6">
              Type at least 2 characters to search
            </p>
          ) : results.length === 0 ? (
            <p className="text-xs text-gcal-text-secondary text-center py-6">
              No events found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul>
              {results.map((event) => {
                const localStart = eventLocalStart(event.startUtc, event.timezone);
                const color = getColor(event.colorId);
                const dateStr = event.isAllDay
                  ? localStart.toFormat("MMM d, yyyy")
                  : localStart.toFormat("MMM d, yyyy · h:mm a");

                return (
                  <li key={`${event.id}-${event.originalStartUtc ?? ""}`}>
                    <button
                      onClick={() => {
                        onNavigate(localStart, event);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color.bg }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gcal-text-primary truncate">
                          {highlight(event.title, query)}
                        </p>
                        <p className="text-xs text-gcal-text-secondary mt-0.5">
                          {dateStr}
                          {event.location && (
                            <span className="ml-2">· {highlight(event.location, query)}</span>
                          )}
                        </p>
                        {event.description && (
                          <p className="text-xs text-gcal-text-secondary truncate mt-0.5">
                            {highlight(event.description, query)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {results.length > 0 && (
          <p className="text-[10px] text-gcal-text-secondary text-center py-2 border-t border-gcal-border">
            Showing events from loaded calendar data · Navigate to other months to expand results
          </p>
        )}
      </motion.div>
    </div>
  );
}
