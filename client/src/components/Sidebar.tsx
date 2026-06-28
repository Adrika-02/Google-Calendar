import { useCalendar } from "@/context/CalendarContext";
import { MiniCalendar } from "./MiniCalendar";
import { IconPlus } from "./icons";

export function Sidebar() {
  const { sidebarOpen, openCreateModal } = useCalendar();

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gcal-border bg-gcal-sidebar-bg flex flex-col overflow-y-auto">
      {/* "+ Create" FAB */}
      <div className="px-4 pt-4 pb-3">
        <button
          onClick={() => openCreateModal()}
          className="flex items-center gap-3 pl-4 pr-6 py-3 bg-white rounded-2xl shadow-md hover:shadow-lg active:shadow-sm transition-shadow text-sm font-medium text-gcal-text-primary"
        >
          <IconPlus size={18} className="text-gcal-text-secondary" />
          Create
        </button>
      </div>

      {/* Mini-calendar */}
      <MiniCalendar />

      {/* Spacer — room for future calendar list */}
      <div className="flex-1" />

      {/* Placeholder calendar list */}
      <div className="px-4 pb-4">
        <p className="text-xs font-medium text-gcal-text-secondary uppercase tracking-wide mb-2">
          My calendars
        </p>
        <div className="flex items-center gap-2 py-1">
          <span className="w-3 h-3 rounded-sm bg-gcal-blue flex-shrink-0" />
          <span className="text-sm text-gcal-text-primary">My Calendar</span>
        </div>
      </div>
    </aside>
  );
}
