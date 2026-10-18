import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { registerSchema } from "@/lib/auth-validation";
import { createPrismaClient } from "@/lib/db-client";
import { authenticateDj, registerDj } from "@/lib/dj-accounts";

const prisma = createPrismaClient();
const input = registerSchema.parse({ email: "DJ@Example.com", displayName: "DJ Marek", password: "tajnehaslo" });

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("registerDj", () => {
  it("creates a FREE user with a bcrypt hash instead of the password", async () => {
    const result = await registerDj(input, prisma);
    expect(result.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "dj@example.com" } });
    expect(user.displayName).toBe("DJ Marek");
    expect(user.plan).toBe("FREE");
    expect(user.passwordHash).not.toBe("tajnehaslo");
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email (case-insensitive after normalization)", async () => {
    await registerDj(input, prisma);
    const again = registerSchema.parse({ email: "dj@example.COM ", displayName: "Inny", password: "innehaslo" });
    expect(await registerDj(again, prisma)).toEqual({ ok: false, reason: "EMAIL_TAKEN" });
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("authenticateDj", () => {
  it("returns the DJ for correct credentials", async () => {
    await registerDj(input, prisma);
    const dj = await authenticateDj({ email: "dj@example.com", password: "tajnehaslo" }, prisma);
    expect(dj).toMatchObject({ email: "dj@example.com", displayName: "DJ Marek" });
    expect(dj).not.toHaveProperty("passwordHash");
  });

  it("returns null for a wrong password and for an unknown email alike", async () => {
    await registerDj(input, prisma);
    expect(await authenticateDj({ email: "dj@example.com", password: "zlehaslo1" }, prisma)).toBeNull();
    expect(await authenticateDj({ email: "nikt@example.com", password: "tajnehaslo" }, prisma)).toBeNull();
  });
});
