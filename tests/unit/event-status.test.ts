import { describe, expect, it } from "vitest";

import {
  applyStatusAction,
  availableStatusActions,
  canTransition,
  EVENT_STATUS_LABELS,
  formatRequestCount,
  type EventStatus,
} from "@/lib/event-status";

const ALL: EventStatus[] = ["DRAFT", "LIVE", "CLOSED"];

describe("canTransition", () => {
  it("allows only DRAFT → LIVE and LIVE → CLOSED", () => {
    const allowed = ALL.flatMap((from) => ALL.filter((to) => canTransition(from, to)).map((to) => `${from}→${to}`));
    expect(allowed).toEqual(["DRAFT→LIVE", "LIVE→CLOSED"]);
  });

  it.each([
    ["CLOSED", "LIVE"],
    ["CLOSED", "DRAFT"],
    ["LIVE", "DRAFT"],
    ["DRAFT", "CLOSED"],
    ["DRAFT", "DRAFT"],
    ["LIVE", "LIVE"],
    ["CLOSED", "CLOSED"],
  ] as const)("rejects %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("applyStatusAction", () => {
  it("start: DRAFT → LIVE", () => {
    expect(applyStatusAction("DRAFT", "start")).toEqual({ ok: true, status: "LIVE" });
  });

  it("close: LIVE → CLOSED", () => {
    expect(applyStatusAction("LIVE", "close")).toEqual({ ok: true, status: "CLOSED" });
  });

  it.each([
    ["CLOSED", "start"],
    ["LIVE", "start"],
    ["DRAFT", "close"],
    ["CLOSED", "close"],
  ] as const)("rejects %s + %s", (status, action) => {
    expect(applyStatusAction(status, action)).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
  });
});

describe("availableStatusActions", () => {
  it("offers the single next step per status", () => {
    expect(availableStatusActions("DRAFT")).toEqual(["start"]);
    expect(availableStatusActions("LIVE")).toEqual(["close"]);
    expect(availableStatusActions("CLOSED")).toEqual([]);
  });

  it("has a Polish label for every status", () => {
    expect(EVENT_STATUS_LABELS).toEqual({ DRAFT: "Szkic", LIVE: "Trwa", CLOSED: "Zakończone" });
  });
});

describe("formatRequestCount", () => {
  it("uses Polish plural forms", () => {
    expect([1, 2, 3, 4, 5, 11, 12, 14, 20, 22, 25].map(formatRequestCount)).toEqual([
      "1 życzenie",
      "2 życzenia",
      "3 życzenia",
      "4 życzenia",
      "5 życzeń",
      "11 życzeń",
      "12 życzeń",
      "14 życzeń",
      "20 życzeń",
      "22 życzenia",
      "25 życzeń",
    ]);
  });
});
