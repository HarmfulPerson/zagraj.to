import { z } from "zod";

import { EVENT_STATUS_ACTIONS } from "@/lib/event-status";

export const EVENT_NAME_MAX_LENGTH = 100;
export const MAX_REQUESTS_PER_GUEST_MIN = 1;
export const MAX_REQUESTS_PER_GUEST_MAX = 20;
export const MAX_REQUESTS_PER_GUEST_DEFAULT = 5;
const EVENT_YEAR_MIN = 2000;
const EVENT_YEAR_MAX = 2100;

const LIMIT_ERROR = `Limit musi być liczbą całkowitą od ${MAX_REQUESTS_PER_GUEST_MIN} do ${MAX_REQUESTS_PER_GUEST_MAX}.`;
const DATE_ERROR = "Podaj poprawną datę.";

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

const nameSchema = z
  .string({ error: "Podaj nazwę wydarzenia." })
  .trim()
  .min(1, { error: "Podaj nazwę wydarzenia." })
  .max(EVENT_NAME_MAX_LENGTH, { error: `Nazwa może mieć najwyżej ${EVENT_NAME_MAX_LENGTH} znaków.` });

/** Accepts a number (JSON API) or a numeric string (form field). Blank input falls back to `fallback`, if given. */
function maxRequestsSchema(fallback?: number) {
  return z.preprocess(
    (value) => {
      if (isBlank(value)) return fallback;
      return typeof value === "string" ? Number(value.trim()) : value;
    },
    z
      .number({ error: LIMIT_ERROR })
      .int({ error: LIMIT_ERROR })
      .min(MAX_REQUESTS_PER_GUEST_MIN, { error: LIMIT_ERROR })
      .max(MAX_REQUESTS_PER_GUEST_MAX, { error: LIMIT_ERROR }),
  );
}

/**
 * Optional calendar date "YYYY-MM-DD" (from <input type="date">). Stored as midnight UTC and
 * always displayed in UTC, so the day never shifts with the server or browser time zone.
 */
const startsAtSchema = z.preprocess(
  (value) => (isBlank(value) ? null : typeof value === "string" ? value.trim() : value),
  z
    .iso.date({ error: DATE_ERROR })
    .refine(
      (value) => {
        const year = Number(value.slice(0, 4));
        return year >= EVENT_YEAR_MIN && year <= EVENT_YEAR_MAX;
      },
      { error: DATE_ERROR },
    )
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .nullable(),
);

export const createEventSchema = z.object({
  name: nameSchema,
  startsAt: startsAtSchema,
  maxRequestsPerGuest: maxRequestsSchema(MAX_REQUESTS_PER_GUEST_DEFAULT),
});

/** Editing: name and per-guest limit (both required). */
export const updateEventSchema = z.object({
  name: nameSchema,
  maxRequestsPerGuest: maxRequestsSchema(),
});

export const eventStatusActionSchema = z.object({
  action: z.enum(EVENT_STATUS_ACTIONS, { error: "Nieznana akcja." }),
});

/** Event ids are cuids; anything else cannot match an event and is treated as "not found". */
export const eventIdSchema = z.string().min(1).max(64);

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/** Date stored by `startsAtSchema` back to the "YYYY-MM-DD" value of a date input. */
export function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}
