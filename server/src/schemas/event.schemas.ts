import { z } from "zod";

const isoDateTime = z
  .string()
  .datetime({ message: "Must be an ISO 8601 UTC datetime string" });

const ianaTimezone = z.string().min(1, "Timezone is required");

// ── Query ─────────────────────────────────────────────────────────────────────

export const listEventsQuerySchema = z.object({
  start: isoDateTime,
  end: isoDateTime,
  tz: ianaTimezone.optional(),
});

// ── Create ────────────────────────────────────────────────────────────────────

export const createEventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    colorId: z.string().default("graphite"),
    startUtc: isoDateTime,
    endUtc: isoDateTime,
    isAllDay: z.boolean().default(false),
    timezone: ianaTimezone,
    rrule: z.string().nullable().optional(),
  })
  .refine((d) => new Date(d.endUtc) > new Date(d.startUtc), {
    message: "endUtc must be after startUtc",
    path: ["endUtc"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

// ── Update ────────────────────────────────────────────────────────────────────

const editScope = z.enum(["single", "thisAndFollowing", "all"]);

export const updateEventSchema = z
  .object({
    // Client must echo the version it last read for optimistic concurrency
    version: z.number().int().nonnegative(),
    editScope: editScope.default("all"),

    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    colorId: z.string().optional(),
    startUtc: isoDateTime.optional(),
    endUtc: isoDateTime.optional(),
    isAllDay: z.boolean().optional(),
    timezone: ianaTimezone.optional(),
    rrule: z.string().nullable().optional(),

    // Required when editScope is "single" or "thisAndFollowing" — identifies
    // which generated occurrence is being targeted
    originalStartUtc: isoDateTime.optional(),
  })
  .refine(
    (d) => {
      if (d.startUtc && d.endUtc) {
        return new Date(d.endUtc) > new Date(d.startUtc);
      }
      return true;
    },
    { message: "endUtc must be after startUtc", path: ["endUtc"] }
  )
  .refine(
    (d) => {
      if (d.editScope === "single" || d.editScope === "thisAndFollowing") {
        return !!d.originalStartUtc;
      }
      return true;
    },
    {
      message: "originalStartUtc is required for single/thisAndFollowing edits",
      path: ["originalStartUtc"],
    }
  );

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ── Delete ────────────────────────────────────────────────────────────────────

export const deleteEventSchema = z
  .object({
    editScope: editScope.default("all"),
    originalStartUtc: isoDateTime.optional(),
  })
  .refine(
    (d) => {
      if (d.editScope === "single" || d.editScope === "thisAndFollowing") {
        return !!d.originalStartUtc;
      }
      return true;
    },
    {
      message: "originalStartUtc is required for single/thisAndFollowing deletes",
      path: ["originalStartUtc"],
    }
  );

export type DeleteEventInput = z.infer<typeof deleteEventSchema>;

// ── Overlap check ─────────────────────────────────────────────────────────────

export const checkOverlapSchema = z.object({
  startUtc: isoDateTime,
  endUtc: isoDateTime,
  excludeId: z.string().cuid().optional(),
});

export type CheckOverlapInput = z.infer<typeof checkOverlapSchema>;
