import { DateTime } from "luxon";

/**
 * Returns every day that appears in the month grid for a given date's month.
 * The grid always starts on Sunday and ends on Saturday.
 * Luxon weekday: Mon=1 … Sun=7. To get Sun=0 offset: weekday % 7.
 */
export function getMonthGridDays(date: DateTime): DateTime[] {
  const first = date.startOf("month");
  const last = date.endOf("month");

  const startPad = first.weekday % 7; // days to prepend from prev month
  const endPad = ((6 - (last.weekday % 7)) + 7) % 7; // days to append from next month

  const gridStart = first.minus({ days: startPad });
  const totalDays = startPad + last.day + endPad;

  return Array.from({ length: totalDays }, (_, i) =>
    gridStart.plus({ days: i })
  );
}

export function isSameDay(a: DateTime, b: DateTime): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Convert a UTC ISO string to the event's local timezone. */
export function eventLocalStart(startUtc: string, timezone: string): DateTime {
  return DateTime.fromISO(startUtc, { zone: "utc" }).setZone(timezone);
}

export function eventLocalEnd(endUtc: string, timezone: string): DateTime {
  return DateTime.fromISO(endUtc, { zone: "utc" }).setZone(timezone);
}

/** Convert a local date + time string to a UTC ISO string in the given IANA timezone. */
export function localToUtc(date: string, time: string, tz: string): string {
  return DateTime.fromISO(`${date}T${time}`, { zone: tz }).toUTC().toISO()!;
}

/** Extract "YYYY-MM-DD" in local timezone from a UTC ISO string. */
export function utcToLocalDate(utcIso: string, tz: string): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat("yyyy-MM-dd");
}

/** Extract "HH:mm" in local timezone from a UTC ISO string. */
export function utcToLocalTime(utcIso: string, tz: string): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat("HH:mm");
}

/**
 * Build an RFC 5545 RRULE string from a RecurrenceState.
 * Returns null when preset is "none".
 */
export function buildRrule(
  preset: string,
  freq: string,
  interval: number,
  byweekday: string[],
  endCondition: string,
  untilDate: string,
  count: number,
  startDate: string,
  tz: string
): string | null {
  if (preset === "none") return null;
  if (preset === "daily") return "FREQ=DAILY";
  if (preset === "weekly") {
    // Derive weekday abbreviation from the start date
    const dow = DateTime.fromISO(startDate).toFormat("EEE").toUpperCase().slice(0, 2);
    return `FREQ=WEEKLY;BYDAY=${dow}`;
  }
  if (preset === "monthly") return "FREQ=MONTHLY";

  // custom
  const parts: string[] = [`FREQ=${freq}`, `INTERVAL=${interval}`];
  if (freq === "WEEKLY" && byweekday.length > 0) {
    parts.push(`BYDAY=${byweekday.join(",")}`);
  }
  if (endCondition === "afterN") {
    parts.push(`COUNT=${Math.max(1, count)}`);
  } else if (endCondition === "onDate" && untilDate) {
    const until = DateTime.fromISO(untilDate, { zone: tz })
      .endOf("day")
      .toUTC()
      .toFormat("yyyyMMdd'T'HHmmss'Z'");
    parts.push(`UNTIL=${until}`);
  }
  return parts.join(";");
}
