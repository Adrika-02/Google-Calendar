import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import type { EventInstance } from "@/types/event";
import { getMonthGridDays } from "@/lib/dateUtils";
import { API_BASE } from "@/lib/apiBase";

async function fetchEvents(
  start: string,
  end: string,
  tz: string
): Promise<EventInstance[]> {
  const params = new URLSearchParams({ start, end, tz });
  const res = await fetch(`${API_BASE}/api/events?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Fetch events failed: ${res.status}`);
  const json = (await res.json()) as { data: EventInstance[] };
  return json.data;
}

/** Generic range query — used by week and day views. */
export function useRangeEvents(start: DateTime, end: DateTime) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: ["events", "range", start.toISODate(), end.toISODate()],
    queryFn: () =>
      fetchEvents(
        start.startOf("day").toUTC().toISO()!,
        end.endOf("day").toUTC().toISO()!,
        tz
      ),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useMonthEvents(focusedDate: DateTime) {
  const days = getMonthGridDays(focusedDate);
  // days[0] is the first Sunday visible; days[last] is the last Saturday
  const gridStart = days[0]!;
  const gridEnd = days[days.length - 1]!;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return useQuery({
    queryKey: ["events", "month", focusedDate.year, focusedDate.month],
    queryFn: () =>
      fetchEvents(
        gridStart.startOf("day").toUTC().toISO()!,
        gridEnd.endOf("day").toUTC().toISO()!,
        tz
      ),
    staleTime: 30_000,
    // Don't throw on network error while server may not be running
    retry: 1,
  });
}
