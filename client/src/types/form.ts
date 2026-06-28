export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "custom";
export type RruleFreq = "DAILY" | "WEEKLY" | "MONTHLY";
export type EndCondition = "never" | "onDate" | "afterN";
export type EditScope = "single" | "thisAndFollowing" | "all";

export interface RecurrenceState {
  preset: RecurrencePreset;
  // custom builder
  freq: RruleFreq;
  interval: number;
  byweekday: string[]; // "MO","TU","WE","TH","FR","SA","SU"
  endCondition: EndCondition;
  untilDate: string;   // "YYYY-MM-DD" local
  count: number;
}

export interface EventFormState {
  title: string;
  startDate: string;  // "YYYY-MM-DD" local
  startTime: string;  // "HH:mm" local
  endDate: string;
  endTime: string;
  isAllDay: boolean;
  location: string;
  description: string;
  colorId: string;
  timezone: string;   // IANA
  recurrence: RecurrenceState;
}

export const DEFAULT_RECURRENCE: RecurrenceState = {
  preset: "none",
  freq: "WEEKLY",
  interval: 1,
  byweekday: [],
  endCondition: "never",
  untilDate: "",
  count: 10,
};
