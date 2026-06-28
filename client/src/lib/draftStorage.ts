import type { EventFormState } from "@/types/form";

const DRAFT_KEY = "gcal_draft_new_event";

export function saveDraft(form: EventFormState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  } catch {
    // storage quota exceeded or private browsing — silently ignore
  }
}

export function loadDraft(): EventFormState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as EventFormState) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}
