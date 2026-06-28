import type { CreateEventPayload, UpdateEventPayload } from "@/api/mutations";

export type QueuedCreate = {
  id: string;
  queuedAt: string;
  type: "create";
  payload: CreateEventPayload;
  optimisticId: string;
};

export type QueuedUpdate = {
  id: string;
  queuedAt: string;
  type: "update";
  payload: UpdateEventPayload;
};

export type QueuedItem = QueuedCreate | QueuedUpdate;

const QUEUE_KEY = "gcal_offline_queue";

function read(): QueuedItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedItem[];
  } catch {
    return [];
  }
}

function persist(queue: QueuedItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function makeId(): string {
  return `oq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getQueue(): QueuedItem[] {
  return read();
}

export function enqueueCreate(payload: CreateEventPayload, optimisticId: string): void {
  const queue = read();
  queue.push({
    id: makeId(),
    queuedAt: new Date().toISOString(),
    type: "create",
    payload,
    optimisticId,
  });
  persist(queue);
}

export function enqueueUpdate(payload: UpdateEventPayload): void {
  const queue = read();
  // Collapse repeated edits to the same event into one queue slot
  const existingIdx = queue
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.type === "update" && item.payload.id === payload.id)
    .pop()?.i ?? -1;

  if (existingIdx >= 0) {
    queue[existingIdx] = { ...(queue[existingIdx] as QueuedUpdate), payload };
  } else {
    queue.push({
      id: makeId(),
      queuedAt: new Date().toISOString(),
      type: "update",
      payload,
    });
  }
  persist(queue);
}

export function dequeue(id: string): void {
  persist(read().filter((item) => item.id !== id));
}
