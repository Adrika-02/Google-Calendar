import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type ToastKind = "error" | "info" | "success";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
  action?: ToastAction;
  durationMs: number;
}

interface ToastCtx {
  toasts: ToastMessage[];
  showToast: (text: string, kind?: ToastKind, action?: ToastAction, durationMs?: number) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);
let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((m) => m.id !== id));
  }, []);

  const showToast = useCallback(
    (
      text: string,
      kind: ToastKind = "error",
      action?: ToastAction,
      durationMs = 4500
    ) => {
      const id = ++nextId;
      setToasts((t) => [...t, { id, text, kind, action, durationMs }]);
      setTimeout(() => dismissToast(id), durationMs + 300);
    },
    [dismissToast]
  );

  return (
    <Ctx.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
