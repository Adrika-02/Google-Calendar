import { RRule } from "rrule";
import { Event, EventException } from "@prisma/client";

export type EventWithRelations = Event & {
  overrides: Event[];
  exceptions: EventException[];
};

export interface EventInstance {
  // Identity
  id: string;
  masterId: string | null;        // null for standalone / master itself
  originalStartUtc: Date | null;  // null for standalone events
  isRecurring: boolean;
  isOverride: boolean;

  // Display fields
  title: string;
  description: string | null;
  location: string | null;
  colorId: string;
  startUtc: Date;
  endUtc: Date;
  isAllDay: boolean;
  timezone: string;
  rrule: string | null;
  userId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Expand a single master event into concrete instances within [windowStart, windowEnd].
 * Applies cancellations (EventException rows) and overrides (child Event rows).
 */
export function expandMaster(
  master: EventWithRelations,
  windowStart: Date,
  windowEnd: Date
): EventInstance[] {
  if (!master.rrule) {
    // Standalone event — include if it overlaps the window
    if (master.endUtc > windowStart && master.startUtc < windowEnd) {
      return [toInstance(master, null, false)];
    }
    return [];
  }

  const rule = RRule.fromString(master.rrule);
  const duration = master.endUtc.getTime() - master.startUtc.getTime();

  // Fetch all occurrence starts whose event body overlaps [windowStart, windowEnd].
  // We query starts from (windowStart - duration) so events that begin before the window
  // but end inside it are included.
  const queryFrom = new Date(windowStart.getTime() - duration);
  const occurrenceStarts: Date[] = rule.between(queryFrom, windowEnd, true);

  // Build lookup sets for O(1) checks
  const cancelledKeys = new Set(
    master.exceptions.map((ex) => ex.originalStartUtc.toISOString())
  );
  const overridesByOriginal = new Map<string, Event>(
    master.overrides.map((ov) => [ov.originalStartUtc!.toISOString(), ov])
  );

  const instances: EventInstance[] = [];

  for (const occStart of occurrenceStarts) {
    const key = occStart.toISOString();
    const occEnd = new Date(occStart.getTime() + duration);

    // Skip if cancelled
    if (cancelledKeys.has(key)) continue;

    // Check window overlap (occEnd > windowStart && occStart < windowEnd)
    const overrideRow = overridesByOriginal.get(key);

    if (overrideRow) {
      // Use the override's own times for overlap check
      if (overrideRow.endUtc > windowStart && overrideRow.startUtc < windowEnd) {
        instances.push(toInstance(overrideRow, master.id, true));
      }
    } else {
      if (occEnd > windowStart && occStart < windowEnd) {
        instances.push(
          toOccurrenceInstance(master, occStart, occEnd)
        );
      }
    }
  }

  return instances;
}

function toInstance(event: Event, masterId: string | null, isOverride: boolean): EventInstance {
  return {
    id: event.id,
    masterId: masterId ?? event.recurrenceId,
    originalStartUtc: event.originalStartUtc,
    isRecurring: !!event.rrule || !!event.recurrenceId,
    isOverride,
    title: event.title,
    description: event.description,
    location: event.location,
    colorId: event.colorId,
    startUtc: event.startUtc,
    endUtc: event.endUtc,
    isAllDay: event.isAllDay,
    timezone: event.timezone,
    rrule: event.rrule,
    userId: event.userId,
    version: event.version,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function toOccurrenceInstance(
  master: Event,
  occStart: Date,
  occEnd: Date
): EventInstance {
  return {
    id: master.id,           // client uses masterId + originalStartUtc to address the occurrence
    masterId: master.id,
    originalStartUtc: occStart,
    isRecurring: true,
    isOverride: false,
    title: master.title,
    description: master.description,
    location: master.location,
    colorId: master.colorId,
    startUtc: occStart,
    endUtc: occEnd,
    isAllDay: master.isAllDay,
    timezone: master.timezone,
    rrule: master.rrule,
    userId: master.userId,
    version: master.version,
    createdAt: master.createdAt,
    updatedAt: master.updatedAt,
  };
}

/**
 * Given an RRULE string and the occurrence we want to split on, return the
 * RRULE string capped with UNTIL = one millisecond before splitStart.
 */
export function capRruleUntil(rruleStr: string, splitStart: Date): string {
  const rule = RRule.fromString(rruleStr);
  // UNTIL must be inclusive of the last occurrence we keep, so we go one ms before splitStart
  const until = new Date(splitStart.getTime() - 1);

  // RRule options work with plain JS objects
  const opts = {
    ...rule.options,
    until,
    count: undefined, // remove COUNT if set — UNTIL takes precedence
  };
  return new RRule(opts).toString();
}
