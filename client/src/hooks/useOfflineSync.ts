import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "./useOnlineStatus";
import { getQueue, dequeue } from "@/lib/offlineQueue";
import { useToast } from "@/context/ToastContext";
import type { EventInstance } from "@/types/event";
import { API_BASE } from "@/lib/apiBase";

/**
 * Mounts once in AppShell. On reconnect (or on initial mount when online and
 * the localStorage queue is non-empty), flushes queued offline mutations and
 * invalidates the event cache.
 *
 * Returns the current online status for use in the offline banner.
 */
export function useOfflineSync(): boolean {
  const isOnline = useOnlineStatus();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline) return;

    // Flush on: going online after being offline, or initial mount with a queued backlog
    const transitionedOnline = !wasOnline;
    const queue = getQueue();
    if (queue.length === 0) return;
    if (!transitionedOnline && wasOnline) return; // already online, nothing new

    const count = queue.length;
    showToast(
      `Syncing ${count} offline change${count > 1 ? "s" : ""}…`,
      "info",
      undefined,
      3000
    );

    void (async () => {
      let synced = 0;
      for (const item of queue) {
        try {
          if (item.type === "create") {
            const res = await fetch(`${API_BASE}/api/events`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.payload),
            });
            if (res.ok) {
              const { data } = (await res.json()) as { data: EventInstance };
              // Swap the optimistic placeholder for the real server record
              qc.setQueriesData<EventInstance[]>({ queryKey: ["events"] }, (old) =>
                old ? old.map((e) => (e.id === item.optimisticId ? data : e)) : old
              );
              dequeue(item.id);
              synced++;
            }
          } else {
            const { id, ...rest } = item.payload;
            const res = await fetch(`${API_BASE}/api/events/${id}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(rest),
            });
            if (res.ok) {
              dequeue(item.id);
              synced++;
            }
          }
        } catch {
          // Network error — leave in queue; will retry on next reconnect
        }
      }

      await qc.invalidateQueries({ queryKey: ["events"] });

      const failed = count - synced;
      if (failed === 0) {
        showToast(`Synced ${count} change${count > 1 ? "s" : ""}`, "success");
      } else {
        showToast(
          `Synced ${synced} of ${count} — ${failed} will retry on reconnect`,
          "error",
          undefined,
          6000
        );
      }
    })();
  }, [isOnline]); // qc and showToast are stable refs; omitting avoids spurious re-runs

  return isOnline;
}
