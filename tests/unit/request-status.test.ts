import { describe, expect, it } from "vitest";

import {
  availableRequestActions,
  canChangeRequestStatus,
  planRequestStatusChange,
  REQUEST_STATUSES,
  type RequestStatus,
} from "@/lib/request-status";

const NOW = new Date("2026-10-24T21:30:00.000Z");

const ALLOWED: [RequestStatus, RequestStatus][] = [
  ["PENDING", "ACCEPTED"],
  ["PENDING", "REJECTED"],
  ["PENDING", "PLAYED"],
  ["ACCEPTED", "PLAYED"],
  ["ACCEPTED", "REJECTED"],
  ["ACCEPTED", "PENDING"],
  ["REJECTED", "PENDING"],
  ["PLAYED", "PENDING"],
];

const allPairs = REQUEST_STATUSES.flatMap((from) => REQUEST_STATUSES.map((to) => [from, to] as [RequestStatus, RequestStatus]));
const isAllowed = ([from, to]: [RequestStatus, RequestStatus]) => ALLOWED.some(([f, t]) => f === from && t === to);
const DISALLOWED = allPairs.filter((pair) => !isAllowed(pair));

describe("request status transitions", () => {
  it.each(ALLOWED)("allows %s → %s", (from, to) => {
    expect(canChangeRequestStatus(from, to)).toBe(true);
    expect(planRequestStatusChange(from, to, NOW).ok).toBe(true);
  });

  it("refuses everything else: the same status again, and REJECTED/PLAYED straight to another final state", () => {
    expect(DISALLOWED).toEqual([
      ["PENDING", "PENDING"],
      ["ACCEPTED", "ACCEPTED"],
      ["REJECTED", "ACCEPTED"],
      ["REJECTED", "REJECTED"],
      ["REJECTED", "PLAYED"],
      ["PLAYED", "ACCEPTED"],
      ["PLAYED", "REJECTED"],
      ["PLAYED", "PLAYED"],
    ]);
    for (const [from, to] of DISALLOWED) {
      expect(canChangeRequestStatus(from, to)).toBe(false);
      expect(planRequestStatusChange(from, to, NOW)).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
    }
  });

  it("'Zagrane' stamps playedAt with the given time", () => {
    for (const from of ["PENDING", "ACCEPTED"] as const) {
      expect(planRequestStatusChange(from, "PLAYED", NOW)).toEqual({ ok: true, data: { status: "PLAYED", playedAt: NOW } });
    }
  });

  it("every other target clears playedAt, so 'Cofnij' from Zagrane forgets the played time", () => {
    expect(planRequestStatusChange("PLAYED", "PENDING", NOW)).toEqual({ ok: true, data: { status: "PENDING", playedAt: null } });
    expect(planRequestStatusChange("PENDING", "ACCEPTED", NOW)).toEqual({ ok: true, data: { status: "ACCEPTED", playedAt: null } });
    expect(planRequestStatusChange("ACCEPTED", "REJECTED", NOW)).toEqual({ ok: true, data: { status: "REJECTED", playedAt: null } });
  });

  it("offers exactly the allowed actions as board buttons, main action first", () => {
    expect(availableRequestActions("PENDING")).toEqual(["ACCEPTED", "PLAYED", "REJECTED"]);
    expect(availableRequestActions("ACCEPTED")).toEqual(["PLAYED", "REJECTED", "PENDING"]);
    expect(availableRequestActions("PLAYED")).toEqual(["PENDING"]);
    expect(availableRequestActions("REJECTED")).toEqual(["PENDING"]);
  });
});
