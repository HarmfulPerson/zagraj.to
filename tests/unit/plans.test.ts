import { describe, expect, it } from "vitest";

import {
  canAddRequest,
  canCustomizePoster,
  canExport,
  canStartEvent,
  describePlanFeatures,
  getPlanLimits,
  PLAN_LIMITS,
  PLAN_MESSAGES,
  planMonthKey,
  planMonthRange,
  polishPlural,
  splitPriceLabel,
} from "@/lib/plans";

const FREE = { plan: "FREE" as const };
const PRO = { plan: "PRO" as const };
const at = (iso: string) => new Date(iso);

describe("PLAN_LIMITS", () => {
  it("matches SPEC: Free = 1 start a month, 100 requests, no export; Pro 25 zł = no limits, export, poster text", () => {
    expect(getPlanLimits("FREE")).toMatchObject({
      name: "Free",
      priceMonthlyPln: 0,
      maxEventStartsPerMonth: 1,
      maxRequestsPerEvent: 100,
      canExport: false,
      canCustomizePoster: false,
    });
    expect(getPlanLimits("PRO")).toMatchObject({
      name: "Pro",
      priceMonthlyPln: 25,
      priceLabel: "25 zł/mies.",
      maxEventStartsPerMonth: null,
      maxRequestsPerEvent: null,
      canExport: true,
      canCustomizePoster: true,
    });
    for (const plan of Object.values(PLAN_LIMITS)) expect(plan.features.length).toBeGreaterThan(0);
  });
});

describe("plan display data", () => {
  it("keeps the current Polish bullets, derived from the limits", () => {
    expect(PLAN_LIMITS.FREE.features).toEqual([
      "1 wydarzenie w miesiącu",
      "Do 100 życzeń na wydarzenie",
      "Kod QR i plakat do druku",
      "Tablica na żywo i głosowanie gości",
    ]);
    expect(PLAN_LIMITS.PRO.features).toEqual([
      "Bez limitu wydarzeń",
      "Bez limitu życzeń",
      "Eksport listy do CSV i jako tekst",
      "Własny tekst na plakacie",
      "Tablica na żywo i głosowanie gości",
    ]);
  });

  it("follows the limit values when they change (no hardcoded numbers)", () => {
    const rules = { maxEventStartsPerMonth: 3, maxRequestsPerEvent: 250, canExport: true, canCustomizePoster: false };
    expect(describePlanFeatures(rules)).toEqual([
      "3 wydarzenia w miesiącu",
      "Do 250 życzeń na wydarzenie",
      "Eksport listy do CSV i jako tekst",
      "Kod QR i plakat do druku",
      "Tablica na żywo i głosowanie gości",
    ]);
    expect(describePlanFeatures({ ...rules, maxEventStartsPerMonth: 5, maxRequestsPerEvent: 1 }).slice(0, 2)).toEqual([
      "5 wydarzeń w miesiącu",
      "Do 1 życzenia na wydarzenie",
    ]);
  });

  it("polishPlural picks 1 / 2–4 / 5+ forms, with 12–14 as many", () => {
    const form = (n: number) => polishPlural(n, "wydarzenie", "wydarzenia", "wydarzeń");
    expect([1, 2, 4, 5, 11, 12, 14, 22, 25, 102].map(form)).toEqual([
      "wydarzenie",
      "wydarzenia",
      "wydarzenia",
      "wydarzeń",
      "wydarzeń",
      "wydarzeń",
      "wydarzeń",
      "wydarzenia",
      "wydarzeń",
      "wydarzenia",
    ]);
  });

  it("splitPriceLabel separates the amount from the billing period without losing text", () => {
    expect(splitPriceLabel(PLAN_LIMITS.PRO.priceLabel)).toEqual({ amount: "25 zł", period: "/mies." });
    expect(splitPriceLabel(PLAN_LIMITS.FREE.priceLabel)).toEqual({ amount: "0 zł", period: "" });
    for (const plan of Object.values(PLAN_LIMITS)) {
      const { amount, period } = splitPriceLabel(plan.priceLabel);
      expect(amount + period).toBe(plan.priceLabel);
    }
  });
});

describe("planMonthKey (Europe/Warsaw)", () => {
  it("puts 23:59 Warsaw in the old month and 00:00 Warsaw in the new one, in winter (UTC+1)", () => {
    // 31 Jan 23:59 Warsaw = 22:59 UTC; 1 Feb 00:00 Warsaw = 31 Jan 23:00 UTC.
    expect(planMonthKey(at("2026-01-31T22:59:59Z"))).toBe("2026-01");
    expect(planMonthKey(at("2026-01-31T23:00:00Z"))).toBe("2026-02");
  });

  it("uses UTC+2 in summer: 1 Jul 00:00 Warsaw is 30 Jun 22:00 UTC", () => {
    expect(planMonthKey(at("2026-06-30T21:59:59Z"))).toBe("2026-06");
    expect(planMonthKey(at("2026-06-30T22:00:00Z"))).toBe("2026-07");
  });

  it("rolls over the year at Warsaw midnight, not at UTC midnight", () => {
    expect(planMonthKey(at("2026-12-31T22:59:59Z"))).toBe("2026-12");
    expect(planMonthKey(at("2026-12-31T23:30:00Z"))).toBe("2027-01");
  });
});

describe("planMonthRange", () => {
  it("returns the Warsaw calendar month as a half-open UTC range", () => {
    expect(planMonthRange(at("2026-07-15T12:00:00Z"))).toEqual({ start: at("2026-06-30T22:00:00Z"), end: at("2026-07-31T22:00:00Z") });
    expect(planMonthRange(at("2026-01-31T23:00:00Z"))).toEqual({ start: at("2026-01-31T23:00:00Z"), end: at("2026-02-28T23:00:00Z") });
  });

  it("handles months with a DST change (start and end have different offsets)", () => {
    // March 2026: DST starts on 29 Mar; the month starts at UTC+1 and ends at UTC+2.
    expect(planMonthRange(at("2026-03-29T12:00:00Z"))).toEqual({ start: at("2026-02-28T23:00:00Z"), end: at("2026-03-31T22:00:00Z") });
    // October 2026: DST ends on 25 Oct; the month starts at UTC+2 and ends at UTC+1.
    expect(planMonthRange(at("2026-10-25T01:30:00Z"))).toEqual({ start: at("2026-09-30T22:00:00Z"), end: at("2026-10-31T23:00:00Z") });
  });

  it("wraps December into January of the next year", () => {
    expect(planMonthRange(at("2026-12-10T10:00:00Z"))).toEqual({ start: at("2026-11-30T23:00:00Z"), end: at("2026-12-31T23:00:00Z") });
  });

  it("agrees with planMonthKey just inside and outside the range", () => {
    for (const now of ["2026-03-10T00:00:00Z", "2026-10-31T23:30:00Z", "2027-02-01T00:00:00Z"]) {
      const { start, end } = planMonthRange(at(now));
      const key = planMonthKey(at(now));
      expect(planMonthKey(start)).toBe(key);
      expect(planMonthKey(new Date(end.getTime() - 1))).toBe(key);
      expect(planMonthKey(end)).not.toBe(key);
      expect(planMonthKey(new Date(start.getTime() - 1))).not.toBe(key);
    }
  });
});

describe("canStartEvent", () => {
  const now = at("2026-10-19T18:00:00Z");

  it("lets a Free DJ start the first event of the month and blocks the second", () => {
    expect(canStartEvent({ ...FREE, startedAt: [] }, now)).toEqual({ ok: true });
    expect(canStartEvent({ ...FREE, startedAt: [at("2026-10-02T20:00:00Z")] }, now)).toEqual({
      ok: false,
      reason: "MONTHLY_START_LIMIT",
      limit: 1,
    });
  });

  it("ignores starts from other months", () => {
    expect(canStartEvent({ ...FREE, startedAt: [at("2026-09-30T20:00:00Z"), at("2025-10-10T20:00:00Z")] }, now)).toEqual({ ok: true });
  });

  it("counts months in Warsaw time: a start at 23:30 Warsaw on 30 Sep is September, at 00:30 on 1 Oct is October", () => {
    const startedLateSeptember = at("2026-09-30T21:30:00Z"); // 23:30 Warsaw (UTC+2)
    const startedEarlyOctober = at("2026-09-30T22:30:00Z"); // 00:30 Warsaw on 1 Oct, still 30 Sep in UTC
    expect(canStartEvent({ ...FREE, startedAt: [startedLateSeptember] }, now).ok).toBe(true);
    expect(canStartEvent({ ...FREE, startedAt: [startedEarlyOctober] }, now).ok).toBe(false);
  });

  it("frees the limit at 00:00 Warsaw on the 1st, even though it is still the previous day in UTC", () => {
    const startedInOctober = [at("2026-10-05T19:00:00Z")];
    expect(canStartEvent({ ...FREE, startedAt: startedInOctober }, at("2026-10-31T22:59:59Z")).ok).toBe(false); // 23:59:59 Warsaw
    expect(canStartEvent({ ...FREE, startedAt: startedInOctober }, at("2026-10-31T23:00:00Z")).ok).toBe(true); // 00:00 on 1 Nov
  });

  it("never limits Pro", () => {
    const many = Array.from({ length: 30 }, (_, i) => new Date(now.getTime() - i * 3600_000));
    expect(canStartEvent({ ...PRO, startedAt: many }, now)).toEqual({ ok: true });
  });
});

describe("canAddRequest", () => {
  it("allows a Free event up to 100 requests (the 100th is still accepted, the 101st is not)", () => {
    expect(canAddRequest(FREE, 0)).toBe(true);
    expect(canAddRequest(FREE, 99)).toBe(true);
    expect(canAddRequest(FREE, 100)).toBe(false);
    expect(canAddRequest(FREE, 150)).toBe(false);
  });

  it("never limits Pro", () => {
    expect(canAddRequest(PRO, 100)).toBe(true);
    expect(canAddRequest(PRO, 10_000)).toBe(true);
  });
});

describe("canExport / canCustomizePoster", () => {
  it("are Pro-only", () => {
    expect(canExport(FREE)).toBe(false);
    expect(canExport(PRO)).toBe(true);
    expect(canCustomizePoster(FREE)).toBe(false);
    expect(canCustomizePoster(PRO)).toBe(true);
  });
});

describe("PLAN_MESSAGES", () => {
  it("are in Polish", () => {
    expect(PLAN_MESSAGES.startLimit(1)).toBe(
      "W planie Free możesz uruchomić 1 wydarzenie w miesiącu kalendarzowym. Przejdź na Pro, aby uruchamiać wydarzenia bez limitu.",
    );
    expect(PLAN_MESSAGES.listFull).toBe("Lista jest pełna");
    expect(PLAN_MESSAGES.exportLocked).toBe("Eksport dostępny w planie Pro");
  });
});
