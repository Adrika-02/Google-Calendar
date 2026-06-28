import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DateTime } from "luxon";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendar } from "@/context/CalendarContext";
import { useCreateEvent, useUpdateEvent, checkOverlap } from "@/api/mutations";
import { useToast } from "@/context/ToastContext";
import { localToUtc, utcToLocalDate, utcToLocalTime, buildRrule } from "@/lib/dateUtils";
import { getColor } from "@/lib/colors";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draftStorage";
import { enqueueCreate, enqueueUpdate } from "@/lib/offlineQueue";
import type { EventInstance } from "@/types/event";
import type { EventFormState, EditScope } from "@/types/form";
import { DEFAULT_RECURRENCE } from "@/types/form";
import { ColorPicker } from "./ColorPicker";
import { RecurrenceSelector } from "./RecurrenceSelector";
import { EditScopeDialog } from "./EditScopeDialog";
import { IconX, IconClock, IconMapPin, IconRepeat } from "@/components/icons";

// ─── Icon helpers ────────────────────────────────────────────────────────────

function IconPalette({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function IconText({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="17" y1="10" x2="3" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  );
}

// ─── Build initial form state ────────────────────────────────────────────────

function buildInitialForm(
  editingEvent: EventInstance | null,
  initialDate: DateTime | null
): EventFormState {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (editingEvent) {
    const startDate = utcToLocalDate(editingEvent.startUtc, editingEvent.timezone);
    const startTime = utcToLocalTime(editingEvent.startUtc, editingEvent.timezone);
    const endDate = utcToLocalDate(editingEvent.endUtc, editingEvent.timezone);
    const endTime = utcToLocalTime(editingEvent.endUtc, editingEvent.timezone);

    return {
      title: editingEvent.title,
      startDate,
      startTime,
      endDate,
      endTime,
      isAllDay: editingEvent.isAllDay,
      location: editingEvent.location ?? "",
      description: editingEvent.description ?? "",
      colorId: editingEvent.colorId,
      timezone: editingEvent.timezone,
      recurrence: {
        ...DEFAULT_RECURRENCE,
        preset: editingEvent.rrule ? "custom" : "none",
      },
    };
  }

  const base = initialDate ?? DateTime.now();
  const startDate = base.toFormat("yyyy-MM-dd");

  return {
    title: "",
    startDate,
    startTime: "09:00",
    endDate: startDate,
    endTime: "10:00",
    isAllDay: false,
    location: "",
    description: "",
    colorId: "graphite",
    timezone: tz,
    recurrence: { ...DEFAULT_RECURRENCE },
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validate(form: EventFormState): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.title.trim()) errs.title = "Title is required";
  if (!form.isAllDay) {
    const startMs = DateTime.fromISO(`${form.startDate}T${form.startTime}`).toMillis();
    const endMs = DateTime.fromISO(`${form.endDate}T${form.endTime}`).toMillis();
    if (endMs <= startMs) errs.time = "End must be after start";
  } else {
    if (form.endDate < form.startDate) errs.time = "End date must be on or after start date";
  }
  return errs;
}

// ─── Row wrapper ─────────────────────────────────────────────────────────────

function FormRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-5 flex-shrink-0 mt-2.5 text-gcal-text-secondary">{icon}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function EventFormModal() {
  const { formOpen, formInitialDate, formEditingEvent, closeFormModal } = useCalendar();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  // All refs and state declared unconditionally (Rules of Hooks)
  const dialogRef = useRef<HTMLDivElement>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEdit = !!formEditingEvent;

  const [form, setForm] = useState<EventFormState>(() =>
    buildInitialForm(formEditingEvent, formInitialDate)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overlaps, setOverlaps] = useState<EventInstance[]>([]);
  const [overlapChecked, setOverlapChecked] = useState(false);
  const [showEditScope, setShowEditScope] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Re-initialise form when the modal opens or the target event changes.
  // For new events, check for a saved draft first.
  useEffect(() => {
    if (!formOpen) {
      setDraftRestored(false);
      return;
    }
    const freshForm = buildInitialForm(formEditingEvent, formInitialDate);
    if (!isEdit) {
      const draft = loadDraft();
      if (draft?.title.trim()) {
        setForm(draft);
        setDraftRestored(true);
      } else {
        setForm(freshForm);
        setDraftRestored(false);
      }
    } else {
      setForm(freshForm);
      setDraftRestored(false);
    }
    setErrors({});
    setOverlaps([]);
    setOverlapChecked(false);
    setSaving(false);
  }, [formOpen, formEditingEvent, formInitialDate]); // isEdit is derived from formEditingEvent

  // Debounced draft save — new events only
  useEffect(() => {
    if (!formOpen || isEdit) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => saveDraft(form), 500);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [form, formOpen, isEdit]);

  // Focus trap — declared before any early return
  useEffect(() => {
    if (!formOpen) return;
    const el = dialogRef.current;
    if (!el) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [formOpen]);

  const set = useCallback(<K extends keyof EventFormState>(k: K, v: EventFormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[k === "startTime" || k === "endTime" ? "time" : k];
      return next;
    });
    setOverlapChecked(false);
  }, []);

  const handleStartDateChange = (d: string) => {
    setForm((prev) => ({
      ...prev,
      startDate: d,
      endDate: prev.endDate < d ? d : prev.endDate,
    }));
    setOverlapChecked(false);
  };

  const handleStartTimeChange = (t: string) => {
    const next = DateTime.fromISO(`${form.startDate}T${t}`).plus({ hours: 1 });
    setForm((prev) => ({
      ...prev,
      startTime: t,
      endDate: next.toFormat("yyyy-MM-dd"),
      endTime: next.toFormat("HH:mm"),
    }));
    setOverlapChecked(false);
  };

  const discardDraft = useCallback(() => {
    clearDraft();
    setDraftRestored(false);
    setForm(buildInitialForm(null, formInitialDate));
  }, [formInitialDate]);

  // ── Save logic ─────────────────────────────────────────────────────────────

  const performSave = useCallback(
    async (editScope?: EditScope) => {
      setSaving(true);

      // Always use the freshest version from the TQ cache to avoid stale-version
      // 409s when the event was mutated (e.g. dragged) after the modal opened.
      let freshVersion = formEditingEvent?.version ?? 0;
      if (formEditingEvent) {
        const cached = qc.getQueriesData<EventInstance[]>({ queryKey: ["events"] });
        for (const [, data] of cached) {
          const hit = data?.find((e) => e.id === formEditingEvent.id);
          if (hit !== undefined) { freshVersion = hit.version; break; }
        }
      }

      const rrule = buildRrule(
        form.recurrence.preset,
        form.recurrence.freq,
        form.recurrence.interval,
        form.recurrence.byweekday,
        form.recurrence.endCondition,
        form.recurrence.untilDate,
        form.recurrence.count,
        form.startDate,
        form.timezone
      );

      const startUtc = form.isAllDay
        ? DateTime.fromISO(form.startDate, { zone: form.timezone }).startOf("day").toUTC().toISO()!
        : localToUtc(form.startDate, form.startTime, form.timezone);
      const endUtc = form.isAllDay
        ? DateTime.fromISO(form.endDate, { zone: form.timezone }).endOf("day").toUTC().toISO()!
        : localToUtc(form.endDate, form.endTime, form.timezone);

      // ── Offline path ─────────────────────────────────────────────────────
      if (!navigator.onLine) {
        if (formEditingEvent) {
          const scope = editScope ?? (formEditingEvent.isRecurring ? "single" : "all");
          const updatePayload = {
            id: formEditingEvent.id,
            version: freshVersion,
            editScope: scope,
            ...(formEditingEvent.originalStartUtc != null && {
              originalStartUtc: formEditingEvent.originalStartUtc,
            }),
            title: form.title.trim(),
            startUtc,
            endUtc,
            isAllDay: form.isAllDay,
            timezone: form.timezone,
            description: form.description || null,
            location: form.location || null,
            colorId: form.colorId,
            rrule,
          };
          // Optimistic cache update
          qc.setQueriesData<EventInstance[]>({ queryKey: ["events"] }, (old) =>
            old
              ? old.map((e) =>
                  e.id === formEditingEvent.id
                    ? {
                        ...e,
                        title: form.title.trim(),
                        startUtc,
                        endUtc,
                        isAllDay: form.isAllDay,
                        description: form.description || null,
                        location: form.location || null,
                        colorId: form.colorId,
                        rrule: rrule ?? null,
                      }
                    : e
                )
              : old
          );
          enqueueUpdate(updatePayload);
        } else {
          const optimisticId = `offline-${Date.now()}`;
          const createPayload = {
            title: form.title.trim(),
            startUtc,
            endUtc,
            isAllDay: form.isAllDay,
            timezone: form.timezone,
            description: form.description || undefined,
            location: form.location || undefined,
            colorId: form.colorId,
            rrule,
          };
          // Optimistic cache insert
          const optimistic: EventInstance = {
            id: optimisticId,
            masterId: null,
            originalStartUtc: null,
            isRecurring: !!rrule,
            isOverride: false,
            title: form.title.trim(),
            description: form.description || null,
            location: form.location || null,
            colorId: form.colorId,
            startUtc,
            endUtc,
            isAllDay: form.isAllDay,
            timezone: form.timezone,
            rrule: rrule ?? null,
            userId: null,
            version: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          qc.setQueriesData<EventInstance[]>({ queryKey: ["events"] }, (old) =>
            old ? [...old, optimistic] : [optimistic]
          );
          enqueueCreate(createPayload, optimisticId);
          clearDraft();
        }

        showToast("Saved offline — will sync when connected", "info", undefined, 5000);
        closeFormModal();
        setSaving(false);
        return;
      }

      // ── Online path ──────────────────────────────────────────────────────
      try {
        if (formEditingEvent) {
          await updateEvent.mutateAsync({
            id: formEditingEvent.id,
            version: freshVersion,
            editScope: editScope ?? (formEditingEvent.isRecurring ? "single" : "all"),
            ...(formEditingEvent.originalStartUtc != null && {
              originalStartUtc: formEditingEvent.originalStartUtc,
            }),
            title: form.title.trim(),
            startUtc,
            endUtc,
            isAllDay: form.isAllDay,
            timezone: form.timezone,
            description: form.description || null,
            location: form.location || null,
            colorId: form.colorId,
            rrule,
          });
        } else {
          await createEvent.mutateAsync({
            title: form.title.trim(),
            startUtc,
            endUtc,
            isAllDay: form.isAllDay,
            timezone: form.timezone,
            description: form.description || undefined,
            location: form.location || undefined,
            colorId: form.colorId,
            rrule,
          });
          clearDraft();
        }
        closeFormModal();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to save. Please try again.";
        showToast(msg, "error");
      } finally {
        setSaving(false);
      }
    },
    [form, formEditingEvent, formInitialDate, createEvent, updateEvent, closeFormModal, qc, showToast]
  );

  const handleScopeConfirm = useCallback(
    (scope: EditScope) => {
      setShowEditScope(false);
      void performSave(scope);
    },
    [performSave]
  );

  const handleSubmit = useCallback(async () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    if (formEditingEvent?.isRecurring && !showEditScope) {
      setShowEditScope(true);
      return;
    }

    if (!overlapChecked) {
      const startUtc = form.isAllDay
        ? DateTime.fromISO(form.startDate, { zone: form.timezone }).startOf("day").toUTC().toISO()!
        : localToUtc(form.startDate, form.startTime, form.timezone);
      const endUtc = form.isAllDay
        ? DateTime.fromISO(form.endDate, { zone: form.timezone }).endOf("day").toUTC().toISO()!
        : localToUtc(form.endDate, form.endTime, form.timezone);

      try {
        const found = await checkOverlap({
          startUtc,
          endUtc,
          excludeId: formEditingEvent?.id,
        });
        setOverlaps(found);
        setOverlapChecked(true);
        if (found.length > 0) return;
      } catch {
        setOverlapChecked(true);
      }
    }

    void performSave();
  }, [form, formEditingEvent, overlapChecked, showEditScope, performSave]);

  // Safe early return — all hooks are above this line
  if (!formOpen) return null;

  const colorBg = getColor(form.colorId).bg;

  return (
    <AnimatePresence>
      {formOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/25 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeFormModal}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="dialog"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={isEdit ? "Edit event" : "New event"}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto flex flex-col max-h-[90vh]"
              initial={{ scale: 0.97, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              {/* ── Color header strip ────────────────────────────── */}
              <div
                className="flex-shrink-0 h-2 rounded-t-2xl"
                style={{ backgroundColor: colorBg }}
              />

              <div className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0">
                <h2 className="text-base font-medium text-gcal-text-primary">
                  {isEdit ? "Edit event" : "New event"}
                </h2>
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
                  aria-label="Close"
                >
                  <IconX size={18} />
                </button>
              </div>

              {/* ── Draft restored banner ─────────────────────────── */}
              <AnimatePresence>
                {draftRestored && (
                  <motion.div
                    key="draft-banner"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex-shrink-0 overflow-hidden"
                  >
                    <div className="mx-6 mb-1 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs">
                      <span className="text-gcal-blue font-medium">Draft restored</span>
                      <button
                        type="button"
                        onClick={discardDraft}
                        className="text-gcal-text-secondary hover:text-gcal-text-primary underline underline-offset-2 transition-colors ml-3"
                      >
                        Discard
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Scrollable body ────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-6 pb-2">
                <div className="flex flex-col gap-5 py-2">
                  {/* Title */}
                  <div>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Add title"
                      value={form.title}
                      onChange={(e) => set("title", e.target.value)}
                      className={[
                        "w-full text-xl font-normal border-b-2 pb-1 bg-transparent focus:outline-none transition-colors placeholder:text-gray-300",
                        errors.title
                          ? "border-red-400 text-red-600 placeholder:text-red-300"
                          : "border-gray-200 focus:border-gcal-blue",
                      ].join(" ")}
                    />
                    {errors.title && (
                      <p className="text-xs text-red-500 mt-1">{errors.title}</p>
                    )}
                  </div>

                  {/* Date / Time */}
                  <FormRow icon={<IconClock size={18} />}>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer self-start">
                        <span className="relative inline-block w-9 h-5">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.isAllDay}
                            onChange={(e) => set("isAllDay", e.target.checked)}
                          />
                          <span className="block w-9 h-5 rounded-full bg-gray-200 peer-checked:bg-gcal-blue transition-colors" />
                          <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                        </span>
                        <span className="text-sm text-gcal-text-secondary">All day</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="border border-gcal-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-gcal-blue"
                        />
                        {!form.isAllDay && (
                          <input
                            type="time"
                            value={form.startTime}
                            onChange={(e) => handleStartTimeChange(e.target.value)}
                            className="border border-gcal-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-gcal-blue"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gcal-text-secondary w-4">→</span>
                        <input
                          type="date"
                          value={form.endDate}
                          min={form.startDate}
                          onChange={(e) => set("endDate", e.target.value)}
                          className="border border-gcal-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-gcal-blue"
                        />
                        {!form.isAllDay && (
                          <input
                            type="time"
                            value={form.endTime}
                            onChange={(e) => set("endTime", e.target.value)}
                            className="border border-gcal-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-gcal-blue"
                          />
                        )}
                      </div>

                      {errors.time && (
                        <p className="text-xs text-red-500">{errors.time}</p>
                      )}
                    </div>
                  </FormRow>

                  {/* Recurrence */}
                  <FormRow icon={<IconRepeat size={18} />}>
                    <RecurrenceSelector
                      value={form.recurrence}
                      startDate={form.startDate}
                      onChange={(r) => set("recurrence", r)}
                    />
                  </FormRow>

                  {/* Location */}
                  <FormRow icon={<IconMapPin size={18} />}>
                    <input
                      type="text"
                      placeholder="Add location"
                      value={form.location}
                      onChange={(e) => set("location", e.target.value)}
                      className="w-full text-sm border-b border-transparent hover:border-gcal-border focus:border-gcal-blue focus:outline-none py-1 placeholder:text-gray-300 bg-transparent transition-colors"
                    />
                  </FormRow>

                  {/* Description */}
                  <FormRow icon={<IconText size={18} />}>
                    <textarea
                      placeholder="Add description"
                      rows={2}
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      className="w-full text-sm border-b border-transparent hover:border-gcal-border focus:border-gcal-blue focus:outline-none py-1 placeholder:text-gray-300 bg-transparent transition-colors resize-none"
                    />
                  </FormRow>

                  {/* Color picker */}
                  <FormRow icon={<IconPalette color={colorBg} />}>
                    <div>
                      <p className="text-xs text-gcal-text-secondary mb-2">Color</p>
                      <ColorPicker
                        value={form.colorId}
                        onChange={(c) => set("colorId", c)}
                      />
                    </div>
                  </FormRow>

                  {/* Overlap warning */}
                  {overlaps.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-amber-800 mb-1">
                        Time conflict detected
                      </p>
                      <ul className="text-xs text-amber-700 space-y-0.5">
                        {overlaps.map((o) => (
                          <li key={o.id}>• {o.title}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-600 mt-2">
                        You can still save — click Save again to proceed.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer ────────────────────────────────────────── */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-gcal-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 text-sm font-medium text-gcal-blue hover:bg-blue-50 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium bg-gcal-blue text-white rounded-full hover:bg-gcal-blue-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : overlaps.length > 0 ? "Save anyway" : "Save"}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Edit scope dialog stacked above */}
          <AnimatePresence>
            {showEditScope && (
              <EditScopeDialog
                onConfirm={handleScopeConfirm}
                onCancel={() => setShowEditScope(false)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
