import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EventInstance } from "@/types/event";
import type { EditScope } from "@/types/form";
import { API_BASE } from "@/lib/apiBase";

// ─── Payload types ─────────────────────────────────────────────────────────

export interface CreateEventPayload {
  title: string;
  startUtc: string;
  endUtc: string;
  isAllDay: boolean;
  timezone: string;
  description?: string;
  location?: string;
  colorId?: string;
  rrule?: string | null;
}

export interface UpdateEventPayload {
  id: string;
  version: number;
  editScope: EditScope;
  originalStartUtc?: string | null;
  title?: string;
  startUtc?: string;
  endUtc?: string;
  isAllDay?: boolean;
  timezone?: string;
  description?: string | null;
  location?: string | null;
  colorId?: string;
  rrule?: string | null;
}

export interface DeleteEventPayload {
  id: string;
  editScope: EditScope;
  originalStartUtc?: string | null;
  version: number;
}

export interface CheckOverlapPayload {
  startUtc: string;
  endUtc: string;
  excludeId?: string;
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function del(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  }
}

// ─── Check overlap ──────────────────────────────────────────────────────────

export async function checkOverlap(payload: CheckOverlapPayload): Promise<EventInstance[]> {
  const body: Record<string, unknown> = {
    startUtc: payload.startUtc,
    endUtc: payload.endUtc,
  };
  if (payload.excludeId) body.excludeId = payload.excludeId;
  const res = await post<{ data: EventInstance[] }>("/api/events/check-overlap", body);
  return res.data;
}

// ─── Shared optimistic helpers ───────────────────────────────────────────────

type CacheSnapshot = [readonly unknown[], EventInstance[] | undefined][];

function snapshotAndCancelAll(
  qc: ReturnType<typeof useQueryClient>
): Promise<CacheSnapshot> {
  return qc.cancelQueries({ queryKey: ["events"] }).then(() => {
    return qc.getQueriesData<EventInstance[]>({ queryKey: ["events"] }) as CacheSnapshot;
  });
}

function restoreSnapshot(
  qc: ReturnType<typeof useQueryClient>,
  snapshot: CacheSnapshot
) {
  for (const [key, data] of snapshot) {
    qc.setQueryData(key, data);
  }
}

// ─── useCreateEvent ──────────────────────────────────────────────────────────

export function useCreateEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateEventPayload) =>
      post<{ data: EventInstance }>("/api/events", payload).then((r) => r.data),

    onMutate: async (payload) => {
      const snapshot = await snapshotAndCancelAll(qc);

      // Inject a placeholder so chips appear immediately
      const optimistic: EventInstance = {
        id: `optimistic-${Date.now()}`,
        masterId: null,
        originalStartUtc: null,
        isRecurring: !!payload.rrule,
        isOverride: false,
        title: payload.title,
        description: payload.description ?? null,
        location: payload.location ?? null,
        colorId: payload.colorId ?? "graphite",
        startUtc: payload.startUtc,
        endUtc: payload.endUtc,
        isAllDay: payload.isAllDay,
        timezone: payload.timezone,
        rrule: payload.rrule ?? null,
        userId: null,
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      qc.setQueriesData<EventInstance[]>({ queryKey: ["events"] }, (old) =>
        old ? [...old, optimistic] : [optimistic]
      );

      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreSnapshot(qc, ctx.snapshot);
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

// ─── useUpdateEvent ──────────────────────────────────────────────────────────

export function useUpdateEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...rest }: UpdateEventPayload) =>
      patch<{ data: EventInstance }>(`/api/events/${id}`, rest).then((r) => r.data),

    onMutate: async (payload) => {
      const snapshot = await snapshotAndCancelAll(qc);

      qc.setQueriesData<EventInstance[]>({ queryKey: ["events"] }, (old) =>
        old
          ? old.map((e) =>
              e.id === payload.id
                ? {
                    ...e,
                    title: payload.title ?? e.title,
                    startUtc: payload.startUtc ?? e.startUtc,
                    endUtc: payload.endUtc ?? e.endUtc,
                    isAllDay: payload.isAllDay ?? e.isAllDay,
                    description: payload.description ?? e.description,
                    location: payload.location ?? e.location,
                    colorId: payload.colorId ?? e.colorId,
                    rrule: payload.rrule !== undefined ? payload.rrule : e.rrule,
                    version: e.version + 1,
                  }
                : e
            )
          : old
      );

      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreSnapshot(qc, ctx.snapshot);
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

// ─── useDeleteEvent ──────────────────────────────────────────────────────────

export function useDeleteEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...rest }: DeleteEventPayload) =>
      del(`/api/events/${id}`, rest),

    onMutate: async (payload) => {
      const snapshot = await snapshotAndCancelAll(qc);

      qc.setQueriesData<EventInstance[]>({ queryKey: ["events"] }, (old) =>
        old ? old.filter((e) => e.id !== payload.id) : old
      );

      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreSnapshot(qc, ctx.snapshot);
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
