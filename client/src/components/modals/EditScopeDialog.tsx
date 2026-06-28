import { useState } from "react";
import { motion } from "framer-motion";
import type { EditScope } from "@/types/form";

interface Props {
  onConfirm: (scope: EditScope) => void;
  onCancel: () => void;
}

const OPTIONS: { scope: EditScope; label: string; desc: string }[] = [
  { scope: "single",           label: "This event",                desc: "Only this occurrence will be changed." },
  { scope: "thisAndFollowing", label: "This and following events", desc: "This and all future occurrences will be changed." },
  { scope: "all",              label: "All events",                desc: "Every occurrence in this series will be changed." },
];

export function EditScopeDialog({ onConfirm, onCancel }: Props) {
  const [scope, setScope] = useState<EditScope>("single");

  return (
    /* Full-screen overlay above the form modal */
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
      >
        <h3 className="text-base font-medium text-gcal-text-primary mb-4">
          Edit recurring event
        </h3>

        <div className="flex flex-col gap-3 mb-6">
          {OPTIONS.map((o) => (
            <label key={o.scope} className="flex gap-3 cursor-pointer group">
              <input
                type="radio"
                name="editScope"
                value={o.scope}
                checked={scope === o.scope}
                onChange={() => setScope(o.scope)}
                className="mt-0.5 accent-gcal-blue flex-shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-gcal-text-primary group-hover:text-gcal-blue transition-colors">
                  {o.label}
                </p>
                <p className="text-xs text-gcal-text-secondary">{o.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gcal-blue hover:bg-blue-50 rounded-full transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(scope)}
            className="px-4 py-2 text-sm font-medium bg-gcal-blue text-white rounded-full hover:bg-gcal-blue-hover transition-colors"
          >
            OK
          </button>
        </div>
      </motion.div>
    </div>
  );
}
