import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { expandMaster, capRruleUntil, EventWithRelations } from "../lib/recurrence.js";
import { NotFoundError, ConflictError, AppError } from "../lib/errors.js";
import {
  listEventsQuerySchema,
  createEventSchema,
  updateEventSchema,
  deleteEventSchema,
  checkOverlapSchema,
} from "../schemas/event.schemas.js";

const router = Router();

// ── Helper: load a master event with its overrides + exceptions ───────────────

async function loadMaster(id: string): Promise<EventWithRelations> {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { overrides: true, exceptions: true },
  });
  if (!event) throw new NotFoundError("Event");
  return event;
}

// ── GET /api/events ───────────────────────────────────────────────────────────
// Returns all event instances (expanded) overlapping [start, end].

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start, end } = listEventsQuerySchema.parse(req.query);
    const windowStart = new Date(start);
    const windowEnd = new Date(end);

    // Fetch master events (no recurrenceId) whose rrule-expansion might touch the window,
    // plus standalone events that directly overlap.
    // For recurring masters we over-fetch slightly (last 2 years back) so long-running
    // series are captured; the expander does the precise overlap check.
    const twoYearsBack = new Date(windowStart.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);

    const masters = await prisma.event.findMany({
      where: {
        userId: req.userId,        // null → guest pool; string → user's events
        recurrenceId: null, // masters and standalones only
        OR: [
          // non-recurring: direct overlap
          {
            rrule: null,
            startUtc: { lt: windowEnd },
            endUtc: { gt: windowStart },
          },
          // recurring masters: started before window end and no UNTIL cap before window start
          // (we fetch all and let the expander filter)
          {
            rrule: { not: null },
            startUtc: { gte: twoYearsBack, lt: windowEnd },
          },
        ],
      },
      include: {
        overrides: true,
        exceptions: true,
      },
    });

    const instances = masters.flatMap((m) =>
      expandMaster(m as EventWithRelations, windowStart, windowEnd)
    );

    // Sort by startUtc ascending
    instances.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());

    res.json({ data: instances });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/events ──────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createEventSchema.parse(req.body);

    const event = await prisma.event.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        location: body.location ?? null,
        colorId: body.colorId,
        startUtc: new Date(body.startUtc),
        endUtc: new Date(body.endUtc),
        isAllDay: body.isAllDay,
        timezone: body.timezone,
        rrule: body.rrule ?? null,
        userId: req.userId,  // from JWT cookie; null for guests
      },
    });

    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/events/:id ─────────────────────────────────────────────────────

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = updateEventSchema.parse(req.body);

    const master = await loadMaster(id);

    // Ownership check — users can only edit their own events (guests own null-userId events)
    if (master.userId !== req.userId) {
      throw new AppError(403, "FORBIDDEN", "You don't have permission to edit this event");
    }

    // Optimistic concurrency check
    if (master.version !== body.version) {
      throw new ConflictError(
        `Version mismatch: expected ${master.version}, got ${body.version}. Reload and retry.`
      );
    }

    const { editScope, originalStartUtc, version: _v, ...fields } = body;

    // Build the partial update payload (only supplied fields)
    const patch = {
      ...(fields.title !== undefined && { title: fields.title }),
      ...(fields.description !== undefined && { description: fields.description }),
      ...(fields.location !== undefined && { location: fields.location }),
      ...(fields.colorId !== undefined && { colorId: fields.colorId }),
      ...(fields.startUtc !== undefined && { startUtc: new Date(fields.startUtc) }),
      ...(fields.endUtc !== undefined && { endUtc: new Date(fields.endUtc) }),
      ...(fields.isAllDay !== undefined && { isAllDay: fields.isAllDay }),
      ...(fields.timezone !== undefined && { timezone: fields.timezone }),
      ...(fields.rrule !== undefined && { rrule: fields.rrule }),
    };

    if (!master.rrule || editScope === "all") {
      // Edit all occurrences (or a standalone event)
      const updated = await prisma.event.update({
        where: { id, version: body.version },
        data: { ...patch, version: { increment: 1 } },
      });
      res.json({ data: updated });
      return;
    }

    const occStart = new Date(originalStartUtc!);

    if (editScope === "single") {
      // Create an override row for just this occurrence
      const newEnd = fields.endUtc
        ? new Date(fields.endUtc)
        : new Date(
            occStart.getTime() + (master.endUtc.getTime() - master.startUtc.getTime())
          );

      const override = await prisma.event.create({
        data: {
          title: fields.title ?? master.title,
          description: fields.description !== undefined ? fields.description : master.description,
          location: fields.location !== undefined ? fields.location : master.location,
          colorId: fields.colorId ?? master.colorId,
          startUtc: fields.startUtc ? new Date(fields.startUtc) : occStart,
          endUtc: newEnd,
          isAllDay: fields.isAllDay ?? master.isAllDay,
          timezone: fields.timezone ?? master.timezone,
          rrule: null,
          recurrenceId: master.id,
          originalStartUtc: occStart,
          userId: master.userId,
        },
      });
      res.status(201).json({ data: override });
      return;
    }

    if (editScope === "thisAndFollowing") {
      // Split the series:
      //   1. Cap the old master's RRULE with UNTIL = occStart - 1ms
      //   2. Create a new master starting at occStart with the edited fields

      const cappedRrule = capRruleUntil(master.rrule, occStart);

      const newStart = fields.startUtc ? new Date(fields.startUtc) : occStart;
      const duration = master.endUtc.getTime() - master.startUtc.getTime();
      const newEnd = fields.endUtc
        ? new Date(fields.endUtc)
        : new Date(newStart.getTime() + duration);

      // Reconstruct the new RRULE based on the edited rrule or master's, starting from newStart
      const newRrule = fields.rrule !== undefined ? fields.rrule : master.rrule;

      await prisma.$transaction([
        // Cap the old master
        prisma.event.update({
          where: { id: master.id },
          data: { rrule: cappedRrule, version: { increment: 1 } },
        }),
        // New master for this-and-following
        prisma.event.create({
          data: {
            title: fields.title ?? master.title,
            description: fields.description !== undefined ? fields.description : master.description,
            location: fields.location !== undefined ? fields.location : master.location,
            colorId: fields.colorId ?? master.colorId,
            startUtc: newStart,
            endUtc: newEnd,
            isAllDay: fields.isAllDay ?? master.isAllDay,
            timezone: fields.timezone ?? master.timezone,
            rrule: newRrule ?? null,
            userId: master.userId,
          },
        }),
      ]);

      res.json({ message: "Series split at the requested occurrence" });
    }
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/events/:id ────────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = deleteEventSchema.parse(req.body ?? {});

    const master = await loadMaster(id);

    // Ownership check
    if (master.userId !== req.userId) {
      throw new AppError(403, "FORBIDDEN", "You don't have permission to delete this event");
    }

    if (!master.rrule || body.editScope === "all") {
      // Delete the whole event / series (cascades overrides + exceptions)
      await prisma.event.delete({ where: { id } });
      res.status(204).send();
      return;
    }

    const occStart = new Date(body.originalStartUtc!);

    if (body.editScope === "single") {
      // Write an EXDATE-style exception row; also delete any existing override for this slot
      await prisma.$transaction([
        prisma.eventException.upsert({
          where: {
            masterId_originalStartUtc: {
              masterId: master.id,
              originalStartUtc: occStart,
            },
          },
          create: { masterId: master.id, originalStartUtc: occStart },
          update: {},
        }),
        // Remove any override row for this occurrence (in case one exists)
        prisma.event.deleteMany({
          where: { recurrenceId: master.id, originalStartUtc: occStart },
        }),
      ]);
      res.status(204).send();
      return;
    }

    if (body.editScope === "thisAndFollowing") {
      // Cap the master's RRULE and delete all overrides/exceptions on-or-after occStart
      const cappedRrule = capRruleUntil(master.rrule, occStart);

      await prisma.$transaction([
        prisma.event.update({
          where: { id: master.id },
          data: { rrule: cappedRrule, version: { increment: 1 } },
        }),
        prisma.event.deleteMany({
          where: {
            recurrenceId: master.id,
            originalStartUtc: { gte: occStart },
          },
        }),
        prisma.eventException.deleteMany({
          where: {
            masterId: master.id,
            originalStartUtc: { gte: occStart },
          },
        }),
      ]);
      res.status(204).send();
    }
  } catch (err) {
    next(err);
  }
});

// ── POST /api/events/check-overlap ───────────────────────────────────────────

router.post("/check-overlap", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startUtc, endUtc, excludeId } = checkOverlapSchema.parse(req.body);
    const start = new Date(startUtc);
    const end = new Date(endUtc);

    const overlapping = await prisma.event.findMany({
      where: {
        userId: req.userId,         // scope to same user / guest pool
        recurrenceId: null,         // only check master/standalone rows directly
        rrule: null,                // skip recurring series (would need expansion)
        ...(excludeId && { id: { not: excludeId } }),
        startUtc: { lt: end },
        endUtc: { gt: start },
      },
      select: {
        id: true,
        title: true,
        startUtc: true,
        endUtc: true,
        colorId: true,
      },
    });

    res.json({ data: overlapping, hasOverlap: overlapping.length > 0 });
  } catch (err) {
    next(err);
  }
});

// Catch invalid sub-paths under /api/events
router.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, "NOT_FOUND", "Route not found"));
});

export default router;
