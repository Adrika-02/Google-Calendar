import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import type { EventInstance } from "@/types/event";
import type { EditScope } from "@/types/form";

const UNDO_DURATION_MS = 6000;

export function useDeleteWithUndo() {
  const qc = useQueryClient();
  const { showToast } = useToast();

  return useCallback(
    async (event: EventInstance, editScope: EditScope = "single") => {
      // 1. Cancel in-flight queries and snapshot all event caches
      await qc.cancelQueries({ queryKey: ["events"] });
      const snapshots = qc.getQueriesData<EventInstance[]>({ queryKey: ["events"] });

      // 2. Optimistically remove from every cache immediately
      qc.setQueriesData<EventInstance[]>({ queryKey: ["events"] }, (old) =>
        old ? old.filter((e) => e.id !== event.id) : old
      );

      let undone = false;

      const restore = () => {
        for (const [key, data] of snapshots) {
          qc.setQueryData(key, data);
        }
      };

      // 3. Schedule actual DELETE after undo window
      const tid = setTimeout(async () => {
        if (undone) return;
        try {
          const res = await fetch(`/api/events/${event.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              editScope,
              version: event.version,
              originalStartUtc: event.originalStartUtc,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          void qc.invalidateQueries({ queryKey: ["events"] });
        } catch {
          restore();
          showToast("Delete failed — event restored.", "error");
        }
      }, UNDO_DURATION_MS);

      // 4. Show undo toast with countdown
      showToast(
        `"${event.title}" deleted`,
        "info",
        {
          label: "Undo",
          onAction: () => {
            undone = true;
            clearTimeout(tid);
            restore();
          },
        },
        UNDO_DURATION_MS
      );
    },
    [qc, showToast]
  );
}
