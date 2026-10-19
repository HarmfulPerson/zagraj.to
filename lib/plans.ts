import type { Plan } from "@/generated/prisma/enums";

export type { Plan };

/**
 * Plans (SPEC.md, "Plany"): the single source of truth for limits and for how plans are presented
 * (panel badge, locked features, pricing page). Everything here is pure: callers pass the data and the time.
 */
export type PlanLimits = {
  /** Display name, e.g. "Free". */
  name: string;
  /** Monthly price in PLN (0 = free). */
  priceMonthlyPln: number;
  /** Price as shown to the user, e.g. "25 zł/mies.". */
  priceLabel: string;
  /** Short Polish description for the pricing page. */
  tagline: string;
  /** Feature bullets in Polish (pricing page, subscription page). */
  features: readonly string[];
  /** How many events may be started (DRAFT → LIVE) per calendar month in `PLAN_TIME_ZONE`; null = no limit. */
  maxEventStartsPerMonth: number | null;
  /** How many requests (not counting REJECTED) one event may hold; null = no limit. */
  maxRequestsPerEvent: number | null;
  /** CSV / text export of the wish list. */
  canExport: boolean;
  /** Own text on the printed poster. */
  canCustomizePoster: boolean;
};

type PlanRules = Pick<PlanLimits, "maxEventStartsPerMonth" | "maxRequestsPerEvent" | "canExport" | "canCustomizePoster">;
type PlanDefinition = Omit<PlanLimits, "features">;

/** Polish plural form for a count: 1 wydarzenie, 2–4 wydarzenia, 5+ (and 12–14) wydarzeń. */
export function polishPlural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

/** "1 wydarzenie w miesiącu", "3 wydarzenia w miesiącu", or "Bez limitu wydarzeń" for null. */
export function formatEventAllowance(maxEventStartsPerMonth: number | null): string {
  const n = maxEventStartsPerMonth;
  return n === null ? "Bez limitu wydarzeń" : `${n} ${polishPlural(n, "wydarzenie", "wydarzenia", "wydarzeń")} w miesiącu`;
}

/**
 * Feature bullets derived from the plan's limits, so the pricing page and the subscription page can never disagree
 * with what the app actually enforces.
 */
export function describePlanFeatures(rules: PlanRules): string[] {
  const requests = rules.maxRequestsPerEvent;
  return [
    formatEventAllowance(rules.maxEventStartsPerMonth),
    requests === null ? "Bez limitu życzeń" : `Do ${requests} ${requests === 1 ? "życzenia" : "życzeń"} na wydarzenie`,
    ...(rules.canExport ? ["Eksport listy do CSV i jako tekst"] : []),
    rules.canCustomizePoster ? "Własny tekst na plakacie" : "Kod QR i plakat do druku",
    "Tablica na żywo i głosowanie gości",
  ];
}

const withFeatures = (plan: PlanDefinition): PlanLimits => ({ ...plan, features: describePlanFeatures(plan) });

export const PLAN_LIMITS: Readonly<Record<Plan, PlanLimits>> = {
  FREE: withFeatures({
    name: "Free",
    priceMonthlyPln: 0,
    priceLabel: "0 zł",
    tagline: "Na pierwszą imprezę i do sprawdzenia, jak to działa.",
    maxEventStartsPerMonth: 1,
    maxRequestsPerEvent: 100,
    canExport: false,
    canCustomizePoster: false,
  }),
  PRO: withFeatures({
    name: "Pro",
    priceMonthlyPln: 25,
    priceLabel: "25 zł/mies.",
    tagline: "Dla DJ-ów, którzy grają co weekend.",
    maxEventStartsPerMonth: null,
    maxRequestsPerEvent: null,
    canExport: true,
    canCustomizePoster: true,
  }),
};

/** Splits a price label for display: "25 zł/mies." → { amount: "25 zł", period: "/mies." }; "0 zł" has no period. */
export function splitPriceLabel(label: string): { amount: string; period: string } {
  const slash = label.indexOf("/");
  return slash === -1 ? { amount: label, period: "" } : { amount: label.slice(0, slash), period: label.slice(slash) };
}

/** Calendar months for the start limit are counted in Polish time, not UTC (a party starting at 00:30 on the 1st is in the new month). */
export const PLAN_TIME_ZONE = "Europe/Warsaw";

export const POSTER_TEXT_MAX_LENGTH = 80;

/** Polish messages about plan limits, shared by the API and the UI. */
export const PLAN_MESSAGES = {
  startLimit: (limit: number) =>
    `W planie Free możesz uruchomić ${limit === 1 ? "1 wydarzenie" : `${limit} wydarzenia`} w miesiącu kalendarzowym. Przejdź na Pro, aby uruchamiać wydarzenia bez limitu.`,
  listFull: "Lista jest pełna",
  listFullDetails: "DJ zebrał już maksymalną liczbę życzeń. Możesz dalej lajkować utwory, które są na liście.",
  exportLocked: "Eksport dostępny w planie Pro",
  posterTextLocked: "Własny tekst na plakacie dostępny w planie Pro",
  upgradeCta: "Przejdź na Pro",
} as const;

type WithPlan = { plan: Plan };

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

const monthFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: PLAN_TIME_ZONE, year: "numeric", month: "2-digit" });
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PLAN_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** "2026-10": the calendar month of the instant in `PLAN_TIME_ZONE`. */
export function planMonthKey(date: Date): string {
  return monthFormatter.format(date).slice(0, 7);
}

/** Offset of `PLAN_TIME_ZONE` from UTC at the instant, in milliseconds (+1 h in winter, +2 h in summer). */
function zoneOffsetMs(epochMs: number): number {
  const parts = Object.fromEntries(partsFormatter.formatToParts(new Date(epochMs)).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - (epochMs - (epochMs % 1000));
}

/** The UTC instant of local midnight on the 1st of the given month (month is 1-based, may overflow into the next year). */
function zonedMonthStart(year: number, month: number): Date {
  const localMidnight = Date.UTC(year, month - 1, 1);
  // DST never switches at midnight on the 1st, so one correction step is always enough.
  const guess = localMidnight - zoneOffsetMs(localMidnight);
  return new Date(localMidnight - zoneOffsetMs(guess));
}

/** The calendar month containing `now` in `PLAN_TIME_ZONE`, as a half-open UTC range [start, end). */
export function planMonthRange(now: Date): { start: Date; end: Date } {
  const [year, month] = planMonthKey(now).split("-").map(Number);
  return { start: zonedMonthStart(year, month), end: zonedMonthStart(year, month + 1) };
}

export type CanStartEventResult = { ok: true } | { ok: false; reason: "MONTHLY_START_LIMIT"; limit: number };

/**
 * May the DJ start (DRAFT → LIVE) another event at `now`? `startedAt` are the start times of the DJ's events;
 * only those in the same calendar month as `now` (in `PLAN_TIME_ZONE`) count.
 */
export function canStartEvent(user: WithPlan & { startedAt: readonly Date[] }, now: Date): CanStartEventResult {
  const limit = getPlanLimits(user.plan).maxEventStartsPerMonth;
  if (limit === null) return { ok: true };
  const month = planMonthKey(now);
  const used = user.startedAt.filter((date) => planMonthKey(date) === month).length;
  return used < limit ? { ok: true } : { ok: false, reason: "MONTHLY_START_LIMIT", limit };
}

/**
 * May one more new track be added to an event whose DJ has `plan`? `requestCount` counts the event's requests
 * except REJECTED ones (a rejected track frees its slot, consistent with the per-guest limit). Votes never count.
 */
export function canAddRequest(event: WithPlan, requestCount: number): boolean {
  const limit = getPlanLimits(event.plan).maxRequestsPerEvent;
  return limit === null || requestCount < limit;
}

export function canExport(user: WithPlan): boolean {
  return getPlanLimits(user.plan).canExport;
}

export function canCustomizePoster(user: WithPlan): boolean {
  return getPlanLimits(user.plan).canCustomizePoster;
}
