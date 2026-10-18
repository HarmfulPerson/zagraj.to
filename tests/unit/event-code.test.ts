import { describe, expect, it, vi } from "vitest";

import {
  EVENT_CODE_ALPHABET,
  EVENT_CODE_LENGTH,
  generateEventCode,
  generateUniqueEventCode,
  isValidEventCode,
  normalizeEventCode,
} from "@/lib/event-code";

describe("event code alphabet", () => {
  it("excludes confusable characters 0, O, 1, I", () => {
    for (const ch of ["0", "O", "1", "I"]) {
      expect(EVENT_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("has no duplicate characters", () => {
    expect(new Set(EVENT_CODE_ALPHABET).size).toBe(EVENT_CODE_ALPHABET.length);
  });
});

describe("generateEventCode", () => {
  const codes = Array.from({ length: 500 }, () => generateEventCode());

  it("generates 6-character codes using only the allowed alphabet", () => {
    expect(EVENT_CODE_LENGTH).toBe(6);
    for (const code of codes) {
      expect(code).toHaveLength(6);
      for (const ch of code) expect(EVENT_CODE_ALPHABET).toContain(ch);
      expect(code).not.toMatch(/[0O1I]/);
      expect(isValidEventCode(code)).toBe(true);
    }
  });

  it("generates unique codes (no collisions in 500 samples; P(collision) ~ 1e-4)", () => {
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses the whole alphabet", () => {
    expect(new Set(codes.join("")).size).toBe(EVENT_CODE_ALPHABET.length);
  });
});

describe("isValidEventCode / normalizeEventCode", () => {
  it("rejects malformed codes", () => {
    for (const code of ["", "ABCDE", "ABCDEFG", "ABCDE0", "ABCDEO", "ABCDE1", "ABCDEI", "abcdef", "ABC-EF"]) {
      expect(isValidEventCode(code)).toBe(false);
    }
  });

  it("normalizes user input", () => {
    expect(normalizeEventCode("  k7qx2m ")).toBe("K7QX2M");
    expect(isValidEventCode(normalizeEventCode(" k7qx2m"))).toBe(true);
  });
});

describe("generateUniqueEventCode", () => {
  it("retries until it finds a free code", async () => {
    const isTaken = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    const code = await generateUniqueEventCode(isTaken);
    expect(isValidEventCode(code)).toBe(true);
    expect(isTaken).toHaveBeenCalledTimes(3);
    expect(isTaken).toHaveBeenLastCalledWith(code);
  });

  it("throws after maxAttempts collisions", async () => {
    const isTaken = vi.fn().mockReturnValue(true);
    await expect(generateUniqueEventCode(isTaken, 4)).rejects.toThrow(/unique event code/);
    expect(isTaken).toHaveBeenCalledTimes(4);
  });
});
