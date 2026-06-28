import { useState, useRef, useEffect } from "react";
import { DateTime } from "luxon";
import { AnimatePresence } from "framer-motion";
import { useCalendar } from "@/context/CalendarContext";
import { useAuth } from "@/context/AuthContext";
import {
  IconMenu,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from "./icons";
import { SearchPanel } from "./SearchPanel";
import type { CalendarView, EventInstance } from "@/types/event";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

function UserMenu() {
  const { user, isGuest, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (isGuest) {
    return (
      <button
        onClick={() => {
          sessionStorage.removeItem("gcal_guest");
          window.location.reload();
        }}
        className="text-sm text-gcal-blue font-medium hover:underline px-2 transition-colors"
      >
        Sign in
      </button>
    );
  }

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full bg-gcal-blue text-white text-sm font-medium flex items-center justify-center hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-gcal-blue focus-visible:ring-offset-1"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-56 bg-white rounded-xl shadow-xl border border-gcal-border z-50 py-1 overflow-hidden"
          role="menu"
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-gcal-border">
            <p className="text-sm font-medium text-gcal-text-primary truncate">{user.name}</p>
            <p className="text-xs text-gcal-text-secondary truncate">{user.email}</p>
          </div>
          {/* Sign out */}
          <button
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gcal-text-primary hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const {
    selectedDate,
    setSelectedDate,
    setNavDirection,
    view,
    setView,
    toggleSidebar,
    openDetail,
  } = useCalendar();

  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearchNavigate = (date: DateTime, event: EventInstance) => {
    setNavDirection(1);
    setSelectedDate(date);
    setView("week");
    openDetail(event);
  };

  const navigate = (dir: 1 | -1) => {
    setNavDirection(dir);
    if (view === "month") setSelectedDate(selectedDate.plus({ months: dir }));
    else if (view === "week") setSelectedDate(selectedDate.plus({ weeks: dir }));
    else setSelectedDate(selectedDate.plus({ days: dir }));
  };

  // Label: "June 2026" for month/week, "Monday, June 29" for day
  const dateLabel =
    view === "day"
      ? selectedDate.toFormat("cccc, MMMM d")
      : selectedDate.toFormat("MMMM yyyy");

  return (
    <div className="relative flex-shrink-0 z-10">
      <header className="h-16 flex items-center gap-1 px-2 border-b border-gcal-border bg-white">
        {/* Hamburger */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
          aria-label="Toggle sidebar"
        >
          <IconMenu size={20} />
        </button>

        {/* GCal-style coloured grid logo + wordmark */}
        <div className="flex items-center gap-1.5 mr-4 ml-1">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="4" y="4" width="12" height="12" rx="1.5" fill="#4285F4" />
            <rect x="20" y="4" width="12" height="12" rx="1.5" fill="#EA4335" />
            <rect x="4" y="20" width="12" height="12" rx="1.5" fill="#34A853" />
            <rect x="20" y="20" width="12" height="12" rx="1.5" fill="#FBBC05" />
          </svg>
          <span className="text-[22px] text-[#3c4043] font-light tracking-tight hidden sm:inline">
            Calendar
          </span>
        </div>

        {/* Today button */}
        <button
          onClick={() => setSelectedDate(DateTime.now())}
          className="px-3 py-1.5 text-sm font-medium text-gcal-text-primary border border-gcal-border rounded-full hover:bg-gray-50 transition-colors mr-1"
        >
          Today
        </button>

        {/* Prev / Next chevrons */}
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
          aria-label={`Previous ${view}`}
        >
          <IconChevronLeft size={20} />
        </button>
        <button
          onClick={() => navigate(1)}
          className="p-2 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
          aria-label={`Next ${view}`}
        >
          <IconChevronRight size={20} />
        </button>

        {/* Date label */}
        <h1 className="text-lg font-normal text-gcal-text-primary flex-1 ml-1 truncate">
          {dateLabel}
        </h1>

        {/* Search */}
        <button
          onClick={() => setSearchOpen((o) => !o)}
          className="p-2 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
          aria-label="Search"
        >
          <IconSearch size={20} />
        </button>

        {/* View switcher — segmented control */}
        <div className="flex border border-gcal-border rounded-lg overflow-hidden text-sm ml-1">
          {VIEWS.map(({ key, label }, i) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={[
                "px-3 py-1.5 font-medium transition-colors",
                i > 0 && "border-l border-gcal-border",
                view === key
                  ? "bg-blue-50 text-gcal-blue"
                  : "text-gcal-text-primary hover:bg-gray-50",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* User avatar / guest sign-in */}
        <div className="ml-2 flex-shrink-0">
          <UserMenu />
        </div>
      </header>

      <AnimatePresence>
        {searchOpen && (
          <SearchPanel
            onClose={() => setSearchOpen(false)}
            onNavigate={handleSearchNavigate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
