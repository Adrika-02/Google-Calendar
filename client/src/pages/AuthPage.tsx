import { useState, useRef, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { registerSchema, loginSchema } from "@/lib/authSchemas";

type Tab = "login" | "register";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-0.5">{message}</p>;
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  error,
  autoFocus,
  placeholder,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoFocus?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gcal-text-primary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={[
          "w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors",
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-gcal-border focus:border-gcal-blue focus:ring-blue-100",
        ].join(" ")}
      />
      <FieldError message={error} />
    </div>
  );
}

export function AuthPage() {
  const { login, register, continueAsGuest } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass]   = useState("");
  const [loginErrs, setLoginErrs]   = useState<Record<string, string>>({});

  // Register form
  const [regName,  setRegName]  = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass,  setRegPass]  = useState("");
  const [regErrs,  setRegErrs]  = useState<Record<string, string>>({});

  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [tab]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPass });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => { if (err.path[0]) errs[err.path[0] as string] = err.message; });
      setLoginErrs(errs);
      return;
    }
    setLoginErrs({});
    setLoading(true);
    try {
      await login(result.data.email, result.data.password);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");
    const result = registerSchema.safeParse({ email: regEmail, name: regName, password: regPass });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => { if (err.path[0]) errs[err.path[0] as string] = err.message; });
      setRegErrs(errs);
      return;
    }
    setRegErrs({});
    setLoading(true);
    try {
      await register(result.data.email, result.data.name, result.data.password);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gcal-sidebar-bg flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <svg width="40" height="40" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="12" height="12" rx="1.5" fill="#4285F4" />
          <rect x="20" y="4" width="12" height="12" rx="1.5" fill="#EA4335" />
          <rect x="4" y="20" width="12" height="12" rx="1.5" fill="#34A853" />
          <rect x="20" y="20" width="12" height="12" rx="1.5" fill="#FBBC05" />
        </svg>
        <span className="text-2xl text-[#3c4043] font-light tracking-tight">Calendar</span>
      </div>

      {/* Card */}
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        style={{ border: "1px solid #dadce0" }}
        role="main"
      >
        {/* Tab bar */}
        <div className="flex border-b border-gcal-border">
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setApiError(""); }}
              className={[
                "flex-1 py-3 text-sm font-medium transition-colors capitalize",
                tab === t
                  ? "text-gcal-blue border-b-2 border-gcal-blue"
                  : "text-gcal-text-secondary hover:text-gcal-text-primary hover:bg-gray-50",
              ].join(" ")}
            >
              {t === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form area */}
        <div className="px-8 py-6">
          <AnimatePresence mode="wait" initial={false}>
            {tab === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleLogin}
                className="flex flex-col gap-4"
                noValidate
              >
                <InputField
                  label="Email"
                  type="email"
                  value={loginEmail}
                  onChange={setLoginEmail}
                  error={loginErrs.email}
                  autoFocus
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <InputField
                  label="Password"
                  type="password"
                  value={loginPass}
                  onChange={setLoginPass}
                  error={loginErrs.password}
                  autoComplete="current-password"
                />

                {apiError && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{apiError}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-gcal-blue text-white text-sm font-medium hover:bg-gcal-blue-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleRegister}
                className="flex flex-col gap-4"
                noValidate
              >
                <InputField
                  label="Name"
                  value={regName}
                  onChange={setRegName}
                  error={regErrs.name}
                  autoFocus
                  placeholder="Your name"
                  autoComplete="name"
                />
                <InputField
                  label="Email"
                  type="email"
                  value={regEmail}
                  onChange={setRegEmail}
                  error={regErrs.email}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <InputField
                  label="Password"
                  type="password"
                  value={regPass}
                  onChange={setRegPass}
                  error={regErrs.password}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />

                {apiError && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{apiError}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-gcal-blue text-white text-sm font-medium hover:bg-gcal-blue-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1"
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Guest path */}
        <div className="px-8 pb-6 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gcal-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gcal-text-secondary">or</span>
            </div>
          </div>
          <button
            type="button"
            onClick={continueAsGuest}
            className="text-sm text-gcal-text-secondary hover:text-gcal-text-primary underline underline-offset-2 transition-colors"
          >
            Continue as guest
          </button>
          <p className="text-xs text-gcal-text-secondary mt-1 leading-relaxed">
            Guest events are shared and not saved to an account.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
