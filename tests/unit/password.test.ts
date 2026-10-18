import { describe, expect, it } from "vitest";

import { BCRYPT_ROUNDS, hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("produces a bcrypt hash, not the plain password", async () => {
    const hash = await hashPassword("tajnehaslo", 4);
    expect(hash).not.toContain("tajnehaslo");
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
  });

  it("uses a salt, so the same password gives different hashes", async () => {
    expect(await hashPassword("tajnehaslo", 4)).not.toBe(await hashPassword("tajnehaslo", 4));
  });

  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("tajnehaslo", 4);
    expect(await verifyPassword("tajnehaslo", hash)).toBe(true);
    expect(await verifyPassword("zlehaslo1", hash)).toBe(false);
  });

  it("uses at least 10 rounds by default", async () => {
    expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(10);
    const hash = await hashPassword("tajnehaslo");
    expect(hash).toMatch(new RegExp(`^\\$2[aby]\\$${BCRYPT_ROUNDS}\\$`));
  });
});
