import type { RequestStatus } from "@/generated/prisma/enums";

export type { RequestStatus };

export const REQUEST_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "PLAYED"] as const satisfies readonly RequestStatus[];

/**
 * Status changes the DJ may make on a request. Everything else is refused, in particular:
 * - the same status again (a double tap, or two devices acting at once): nothing to change;
 * - REJECTED → ACCEPTED / PLAYED and PLAYED → ACCEPTED / REJECTED: a rejected or played track first goes
 *   back to PENDING ("Cofnij do PENDING"), so an accidental tap can always be undone in one step.
 */
export const REQUEST_STATUS_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  PENDING: ["ACCEPTED", "REJECTED", "PLAYED"],
  ACCEPTED: ["PLAYED", "REJECTED", "PENDING"],
  REJECTED: ["PENDING"],
  PLAYED: ["PENDING"],
};

export function canChangeRequestStatus(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_STATUS_TRANSITIONS[from].includes(to);
}

export type RequestStatusChange =
  | { ok: true; data: { status: RequestStatus; playedAt: Date | null } }
  | { ok: false; reason: "INVALID_TRANSITION" };

/**
 * The fields to write when the DJ moves a request from `from` to `to`: "Zagrane" (PLAYED) stamps `playedAt`
 * with `now`; every other target clears it, so a track taken back from "Zagrane" loses its played time.
 */
export function planRequestStatusChange(from: RequestStatus, to: RequestStatus, now: Date): RequestStatusChange {
  if (!canChangeRequestStatus(from, to)) return { ok: false, reason: "INVALID_TRANSITION" };
  return { ok: true, data: { status: to, playedAt: to === "PLAYED" ? now : null } };
}

/** Board buttons: "Akceptuj", "Odrzuć", "Zagrane", "Cofnij do PENDING". */
export const REQUEST_ACTION_LABELS: Readonly<Record<RequestStatus, string>> = {
  ACCEPTED: "Akceptuj",
  REJECTED: "Odrzuć",
  PLAYED: "Zagrane",
  PENDING: "Cofnij do nowych",
};

/** Target statuses offered as buttons for a request in `status`, in display order (main action first). */
export function availableRequestActions(status: RequestStatus): RequestStatus[] {
  const order: RequestStatus[] = ["ACCEPTED", "PLAYED", "REJECTED", "PENDING"];
  return order.filter((to) => canChangeRequestStatus(status, to));
}
