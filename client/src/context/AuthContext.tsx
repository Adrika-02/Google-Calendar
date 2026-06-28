import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { API_BASE } from "@/lib/apiBase";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthCtx {
  user: AuthUser | null;
  /** True once the initial /me check has resolved */
  isLoading: boolean;
  /** True when the user chose "Continue as guest" */
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const GUEST_KEY = "gcal_guest";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // On mount: check for an existing valid session
  useEffect(() => {
    const wasGuest = sessionStorage.getItem(GUEST_KEY) === "1";

    apiFetch<{ data: AuthUser }>(`${API_BASE}/api/auth/me`)
      .then(({ data }) => {
        setUser(data);
        setIsGuest(false);
        sessionStorage.removeItem(GUEST_KEY);
      })
      .catch(() => {
        // No valid session — restore guest mode from sessionStorage if set
        if (wasGuest) setIsGuest(true);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiFetch<{ data: AuthUser }>(`${API_BASE}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data);
    setIsGuest(false);
    sessionStorage.removeItem(GUEST_KEY);
  }, []);

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      const { data } = await apiFetch<{ data: AuthUser }>(`${API_BASE}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify({ email, name, password }),
      });
      setUser(data);
      setIsGuest(false);
      sessionStorage.removeItem(GUEST_KEY);
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    setIsGuest(false);
    sessionStorage.removeItem(GUEST_KEY);
  }, []);

  const continueAsGuest = useCallback(() => {
    sessionStorage.setItem(GUEST_KEY, "1");
    setIsGuest(true);
  }, []);

  return (
    <Ctx.Provider value={{ user, isLoading, isGuest, login, register, logout, continueAsGuest }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
