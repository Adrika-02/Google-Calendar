export interface EventInstance {
  id: string;
  masterId: string | null;
  originalStartUtc: string | null;
  isRecurring: boolean;
  isOverride: boolean;
  title: string;
  description: string | null;
  location: string | null;
  colorId: string;
  startUtc: string;
  endUtc: string;
  isAllDay: boolean;
  timezone: string;
  rrule: string | null;
  userId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type CalendarView = "month" | "week" | "day";
