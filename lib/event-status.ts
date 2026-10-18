import type { EventStatus } from "@/generated/prisma/enums";

export type { EventStatus };

/** Allowed status changes. An event only moves forward: DRAFT → LIVE → CLOSED. */
export const EVENT_STATUS_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  DRAFT: ["LIVE"],
  LIVE: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return EVENT_STATUS_TRANSITIONS[from].includes(to);
}

/** DJ actions on an event: "Rozpocznij" (start) and "Zakończ" (close). */
export const EVENT_STATUS_ACTIONS = ["start", "close"] as const;
export type EventStatusAction = (typeof EVENT_STATUS_ACTIONS)[number];

export const EVENT_STATUS_ACTION_TARGET: Readonly<Record<EventStatusAction, EventStatus>> = {
  start: "LIVE",
  close: "CLOSED",
};

export type StatusActionResult = { ok: true; status: EventStatus } | { ok: false; reason: "INVALID_TRANSITION" };

/** The status after applying `action` to an event in `current` status, or an error for a forbidden change. */
export function applyStatusAction(current: EventStatus, action: EventStatusAction): StatusActionResult {
  const target = EVENT_STATUS_ACTION_TARGET[action];
  return canTransition(current, target) ? { ok: true, status: target } : { ok: false, reason: "INVALID_TRANSITION" };
}

/** Actions the DJ can take on an event in the given status (drives which buttons are shown). */
export function availableStatusActions(status: EventStatus): EventStatusAction[] {
  return EVENT_STATUS_ACTIONS.filter((action) => canTransition(status, EVENT_STATUS_ACTION_TARGET[action]));
}

export const EVENT_STATUS_LABELS: Readonly<Record<EventStatus, string>> = {
  DRAFT: "Szkic",
  LIVE: "Trwa",
  CLOSED: "Zakończone",
};

/** "1 życzenie", "3 życzenia", "5 życzeń", "22 życzenia" (Polish plural rules). */
export function formatRequestCount(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return "1 życzenie";
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} życzenia`;
  return `${count} życzeń`;
}
