import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast, type ToastMessage } from "@/context/ToastContext";

const KIND_STYLES = {
  error:   "bg-[#202124] text-white",
  info:    "bg-[#202124] text-white",
  success: "bg-[#202124] text-white",
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const { durationMs } = toast;
    let rafId: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / durationMs) * 100));
      if (elapsed < durationMs) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [toast]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={[
        "pointer-events-auto relative overflow-hidden rounded-lg shadow-lg",
        "min-w-72 max-w-sm",
        KIND_STYLES[toast.kind],
      ].join(" ")}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 text-sm font-medium">{toast.text}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onAction();
              onDismiss();
            }}
            className="text-sm font-semibold text-gcal-blue hover:text-blue-300 transition-colors flex-shrink-0 uppercase tracking-wide"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-white/60 hover:text-white transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-white/30 transition-none"
        style={{ width: `${progress}%` }}
      />
    </motion.div>
  );
}

export function Toast() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
