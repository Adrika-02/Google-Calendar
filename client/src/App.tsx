import { useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { DateTime } from "luxon";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CalendarProvider, useCalendar } from "@/context/CalendarContext";
import { ToastProvider } from "@/context/ToastContext";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { MonthView } from "@/components/month/MonthView";
import { WeekView } from "@/components/week/WeekView";
import { EventFormModal } from "@/components/modals/EventFormModal";
import { EventDetailPopover } from "@/components/stubs/EventDetailPopover";
import { ShortcutsDialog } from "@/components/modals/ShortcutsDialog";
import { Toast } from "@/components/Toast";
import { AuthPage } from "@/pages/AuthPage";
import { useKeyboardShortcuts, type ShortcutAction } from "@/hooks/useKeyboardShortcuts";
import { useOfflineSync } from "@/hooks/useOfflineSync";

const queryClient = new QueryClient();

function weekStart(date: DateTime): DateTime {
  return date.minus({ days: date.weekday % 7 });
}

function animKey(view: string, selectedDate: DateTime): string {
  if (view === "month") return `month-${selectedDate.year}-${selectedDate.month}`;
  if (view === "week") return `week-${weekStart(selectedDate).toISODate()}`;
  return `day-${selectedDate.toISODate()}`;
}

function AppShell() {
  const {
    view, selectedDate, navDirection,
    setView, setSelectedDate, setNavDirection,
    openCreateModal,
    formOpen, activeEvent, shortcutsOpen,
    openShortcuts, closeShortcuts, closeFormModal, closeDetail,
  } = useCalendar();

  const anyModalOpen = formOpen || activeEvent !== null || shortcutsOpen;

  const navigate = useCallback(
    (direction: 1 | -1) => {
      setNavDirection(direction);
      setSelectedDate(
        view === "month"
          ? selectedDate.plus({ months: direction })
          : view === "week"
          ? selectedDate.plus({ weeks: direction })
          : selectedDate.plus({ days: direction })
      );
    },
    [view, selectedDate, setSelectedDate, setNavDirection]
  );

  const handleShortcut = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case "today":
          setSelectedDate(DateTime.now());
          break;
        case "month":
          setView("month");
          break;
        case "week":
          setView("week");
          break;
        case "day":
          setView("day");
          break;
        case "prev":
          navigate(-1);
          break;
        case "next":
          navigate(1);
          break;
        case "create":
          if (!anyModalOpen) openCreateModal();
          break;
        case "shortcuts":
          if (!formOpen && !activeEvent) openShortcuts();
          break;
        case "close":
          if (shortcutsOpen) closeShortcuts();
          else if (activeEvent) closeDetail();
          else if (formOpen) closeFormModal();
          break;
      }
    },
    [
      navigate, setSelectedDate, setView, openCreateModal,
      formOpen, activeEvent, shortcutsOpen, anyModalOpen,
      openShortcuts, closeShortcuts, closeDetail, closeFormModal,
    ]
  );

  useKeyboardShortcuts({ onAction: handleShortcut, disabled: formOpen });
  const isOnline = useOfflineSync();

  // Build day arrays for week and day views
  const ws = weekStart(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => ws.plus({ days: i }));
  const dayDays = [selectedDate];

  const key = animKey(view, selectedDate);
  const dx = navDirection * 28;

  return (
    <div className="flex flex-col h-full">
      <TopBar />

      {!isOnline && (
        <div className="flex-shrink-0 bg-amber-500 text-white text-xs text-center py-1.5 px-4 z-20">
          You&apos;re offline — changes will sync automatically when connected
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={key}
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, x: dx }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dx }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              {view === "month" && <MonthView />}
              {view === "week" && <WeekView days={weekDays} />}
              {view === "day" && <WeekView days={dayDays} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <EventFormModal />
      <EventDetailPopover />

      <AnimatePresence>
        {shortcutsOpen && <ShortcutsDialog onClose={closeShortcuts} />}
      </AnimatePresence>
    </div>
  );
}

function AuthGate() {
  const { user, isLoading, isGuest } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gcal-sidebar-bg">
        <div className="w-8 h-8 border-2 border-gcal-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !isGuest) {
    return <AuthPage />;
  }

  return (
    <CalendarProvider>
      <AppShell />
      <Toast />
    </CalendarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <AuthGate />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
