import { describe, expect, it } from "vitest";

import { firstFieldErrors, loginSchema, normalizeEmail, registerSchema } from "@/lib/auth-validation";

const valid = { email: "dj@example.com", displayName: "DJ Marek", password: "tajnehaslo" };

describe("registerSchema", () => {
  it("accepts valid input and normalizes email and display name", () => {
    const result = registerSchema.parse({ ...valid, email: "  DJ@Example.COM ", displayName: "  DJ Marek  " });
    expect(result).toEqual({ email: "dj@example.com", displayName: "DJ Marek", password: "tajnehaslo" });
  });

  it("rejects an invalid email with a Polish message", () => {
    const result = registerSchema.safeParse({ ...valid, email: "nie-email" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error).email).toBe("Podaj poprawny adres e-mail.");
  });

  it("requires a password of at least 8 characters", () => {
    expect(registerSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "12345678" }).success).toBe(true);
    const result = registerSchema.safeParse({ ...valid, password: "short" });
    if (!result.success) expect(firstFieldErrors(result.error).password).toBe("Hasło musi mieć co najmniej 8 znaków.");
  });

  it("rejects passwords longer than 72 bytes (bcrypt limit)", () => {
    expect(registerSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, password: "a".repeat(73) }).success).toBe(false);
    // Polish letters take 2 bytes in UTF-8.
    expect(registerSchema.safeParse({ ...valid, password: "ą".repeat(37) }).success).toBe(false);
  });

  it("requires a display name of 2 to 50 characters", () => {
    expect(registerSchema.safeParse({ ...valid, displayName: " A " }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, displayName: "x".repeat(51) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, displayName: "DJ" }).success).toBe(true);
  });

  it("reports missing fields", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(firstFieldErrors(result.error)).sort()).toEqual(["displayName", "email", "password"]);
    }
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password (no length hints for attackers)", () => {
    expect(loginSchema.parse({ email: "DJ@example.com", password: "x" })).toEqual({ email: "dj@example.com", password: "x" });
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "dj@example.com", password: "" }).success).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ala@Example.PL ")).toBe("ala@example.pl");
  });
});
