import { describe, expect, it } from "vitest";

import {
  createEventSchema,
  eventStatusActionSchema,
  toDateInputValue,
  updateEventSchema,
} from "@/lib/event-validation";

describe("createEventSchema", () => {
  it("requires only the name; date is null and the limit defaults to 5", () => {
    expect(createEventSchema.parse({ name: "  Wesele Ani  " })).toEqual({ name: "Wesele Ani", startsAt: null, maxRequestsPerGuest: 5 });
    expect(createEventSchema.parse({ name: "Wesele", startsAt: "", maxRequestsPerGuest: "" })).toEqual({
      name: "Wesele",
      startsAt: null,
      maxRequestsPerGuest: 5,
    });
  });

  it("rejects a missing, blank or too long name with a Polish message", () => {
    for (const name of [undefined, "", "   "]) {
      const result = createEventSchema.safeParse({ name });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Podaj nazwę wydarzenia.");
    }
    expect(createEventSchema.safeParse({ name: "x".repeat(100) }).success).toBe(true);
    expect(createEventSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
  });

  it("accepts the limit 1–20 as a number or a numeric string", () => {
    expect(createEventSchema.parse({ name: "E", maxRequestsPerGuest: 1 }).maxRequestsPerGuest).toBe(1);
    expect(createEventSchema.parse({ name: "E", maxRequestsPerGuest: "20" }).maxRequestsPerGuest).toBe(20);
    expect(createEventSchema.parse({ name: "E", maxRequestsPerGuest: " 7 " }).maxRequestsPerGuest).toBe(7);
  });

  it.each([0, 21, -1, 5.5, "abc", "5.5", "0", "21", true, [], {}])("rejects limit %j", (maxRequestsPerGuest) => {
    const result = createEventSchema.safeParse({ name: "E", maxRequestsPerGuest });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Limit musi być liczbą całkowitą od 1 do 20.");
  });

  it("parses a calendar date as midnight UTC", () => {
    const { startsAt } = createEventSchema.parse({ name: "E", startsAt: "2026-10-24" });
    expect(startsAt?.toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(toDateInputValue(startsAt)).toBe("2026-10-24");
    expect(toDateInputValue(null)).toBe("");
  });

  it.each(["24.10.2026", "2026-13-01", "2026-02-30", "1999-12-31", "2101-01-01", "2026-10-24T18:00", 20261024])(
    "rejects date %j",
    (startsAt) => {
      const result = createEventSchema.safeParse({ name: "E", startsAt });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Podaj poprawną datę.");
    },
  );
});

describe("updateEventSchema", () => {
  it("requires name and limit", () => {
    expect(updateEventSchema.parse({ name: "Nowa", maxRequestsPerGuest: "3" })).toEqual({ name: "Nowa", maxRequestsPerGuest: 3 });
    expect(updateEventSchema.safeParse({ name: "Nowa" }).success).toBe(false);
    expect(updateEventSchema.safeParse({ name: "Nowa", maxRequestsPerGuest: "" }).success).toBe(false);
    expect(updateEventSchema.safeParse({ maxRequestsPerGuest: 3 }).success).toBe(false);
  });

  it("ignores fields that cannot be edited", () => {
    const parsed = updateEventSchema.parse({ name: "N", maxRequestsPerGuest: 3, status: "LIVE", code: "AAAAAA", djId: "x" });
    expect(parsed).toEqual({ name: "N", maxRequestsPerGuest: 3 });
  });

  it("takes an optional poster text: trimmed to one line, blank clears it, at most 80 characters", () => {
    const base = { name: "N", maxRequestsPerGuest: 3 };
    expect(updateEventSchema.parse(base)).not.toHaveProperty("posterText");
    expect(updateEventSchema.parse({ ...base, posterText: "  Bawimy się\n do rana!  " }).posterText).toBe("Bawimy się do rana!");
    expect(updateEventSchema.parse({ ...base, posterText: "   " }).posterText).toBeNull();
    expect(updateEventSchema.parse({ ...base, posterText: null }).posterText).toBeNull();
    expect(updateEventSchema.parse({ ...base, posterText: "x".repeat(80) }).posterText).toHaveLength(80);
    const tooLong = updateEventSchema.safeParse({ ...base, posterText: "x".repeat(81) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0].message).toBe("Tekst na plakat może mieć najwyżej 80 znaków.");
    expect(updateEventSchema.safeParse({ ...base, posterText: 5 }).success).toBe(false);
  });
});

describe("eventStatusActionSchema", () => {
  it("accepts only start and close", () => {
    expect(eventStatusActionSchema.parse({ action: "start" })).toEqual({ action: "start" });
    expect(eventStatusActionSchema.parse({ action: "close" })).toEqual({ action: "close" });
    for (const action of ["LIVE", "reopen", "", undefined, 1]) {
      expect(eventStatusActionSchema.safeParse({ action }).success).toBe(false);
    }
  });
});
