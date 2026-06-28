import { useCalendar } from "@/context/CalendarContext";
import { IconX } from "@/components/icons";

export function CreateEventModal() {
  const { createModalOpen, closeCreateModal, createInitialDate } = useCalendar();

  if (!createModalOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={closeCreateModal}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gcal-border">
            <h2 className="text-lg font-medium text-gcal-text-primary">
              New event
            </h2>
            <button
              onClick={closeCreateModal}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gcal-text-secondary transition-colors"
              aria-label="Close"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Body placeholder */}
          <div className="px-6 py-10 flex flex-col items-center gap-3">
            <p className="text-sm text-gcal-text-secondary">
              Create event form — coming soon.
            </p>
            {createInitialDate && (
              <p className="text-xs text-gcal-text-secondary bg-gray-50 px-3 py-1.5 rounded-full">
                {createInitialDate.toFormat("cccc, LLLL d, yyyy")}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex justify-end gap-2">
            <button
              onClick={closeCreateModal}
              className="px-4 py-2 text-sm font-medium text-gcal-blue hover:bg-blue-50 rounded-full transition-colors"
            >
              Cancel
            </button>
            <button className="px-4 py-2 text-sm font-medium bg-gcal-blue text-white rounded-full hover:bg-gcal-blue-hover transition-colors">
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
