import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { DateTime } from "luxon";
import type { CalendarView, EventInstance } from "@/types/event";

interface CalendarState {
  selectedDate: DateTime;
  setSelectedDate: (d: DateTime) => void;
  /** -1 = navigating backward, 1 = navigating forward. Used by Framer Motion. */
  navDirection: 1 | -1;
  setNavDirection: (d: 1 | -1) => void;
  view: CalendarView;
  setView: (v: CalendarView) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  // Unified create/edit form modal
  formOpen: boolean;
  formInitialDate: DateTime | null;
  formEditingEvent: EventInstance | null;
  openCreateModal: (date?: DateTime) => void;
  openEditModal: (event: EventInstance) => void;
  closeFormModal: () => void;
  // Legacy aliases consumed by older call sites
  createModalOpen: boolean;
  createInitialDate: DateTime | null;
  closeCreateModal: () => void;
  // Event detail popover
  activeEvent: EventInstance | null;
  openDetail: (event: EventInstance) => void;
  closeDetail: () => void;
  // Keyboard shortcuts dialog
  shortcutsOpen: boolean;
  openShortcuts: () => void;
  closeShortcuts: () => void;
}

const Ctx = createContext<CalendarState | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<DateTime>(DateTime.now());
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const [view, setView] = useState<CalendarView>("month");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitialDate, setFormInitialDate] = useState<DateTime | null>(null);
  const [formEditingEvent, setFormEditingEvent] = useState<EventInstance | null>(null);

  const [activeEvent, setActiveEvent] = useState<EventInstance | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const openCreateModal = (date?: DateTime) => {
    setFormEditingEvent(null);
    setFormInitialDate(date ?? selectedDate);
    setFormOpen(true);
  };

  const openEditModal = (event: EventInstance) => {
    setFormInitialDate(null);
    setFormEditingEvent(event);
    setFormOpen(true);
  };

  const closeFormModal = () => {
    setFormOpen(false);
    setFormInitialDate(null);
    setFormEditingEvent(null);
  };

  return (
    <Ctx.Provider
      value={{
        selectedDate,
        setSelectedDate,
        navDirection,
        setNavDirection,
        view,
        setView,
        sidebarOpen,
        toggleSidebar: () => setSidebarOpen((p) => !p),
        formOpen,
        formInitialDate,
        formEditingEvent,
        openCreateModal,
        openEditModal,
        closeFormModal,
        // legacy aliases
        createModalOpen: formOpen,
        createInitialDate: formInitialDate,
        closeCreateModal: closeFormModal,
        activeEvent,
        openDetail: setActiveEvent,
        closeDetail: () => setActiveEvent(null),
        shortcutsOpen,
        openShortcuts: () => setShortcutsOpen(true),
        closeShortcuts: () => setShortcutsOpen(false),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCalendar(): CalendarState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCalendar must be used inside CalendarProvider");
  return ctx;
}
