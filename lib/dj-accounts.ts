import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { LoginInput, RegisterInput } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export type DjAccount = { id: string; email: string; displayName: string };

export type RegisterResult = { ok: true; dj: DjAccount } | { ok: false; reason: "EMAIL_TAKEN" };

const accountSelect = { id: true, email: true, displayName: true } as const;

/** Creates a DJ account. Expects input already validated (and email normalized) by `registerSchema`. */
export async function registerDj(input: RegisterInput, db: PrismaClient = prisma): Promise<RegisterResult> {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) return { ok: false, reason: "EMAIL_TAKEN" };

  const passwordHash = await hashPassword(input.password);
  try {
    const dj = await db.user.create({
      data: { email: input.email, displayName: input.displayName, passwordHash },
      select: accountSelect,
    });
    return { ok: true, dj };
  } catch (error) {
    // Race: someone registered the same email between the check and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "EMAIL_TAKEN" };
    }
    throw error;
  }
}

// Compared against when the email is unknown, so both paths take similar time
// and response timing does not reveal whether an account exists.
let dummyHashPromise: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("zagrajto-dummy-password");
  return dummyHashPromise;
}

/** Returns the DJ for valid credentials, otherwise null (same result for unknown email and wrong password). */
export async function authenticateDj(input: LoginInput, db: PrismaClient = prisma): Promise<DjAccount | null> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { ...accountSelect, passwordHash: true },
  });
  if (!user) {
    await verifyPassword(input.password, await dummyHash());
    return null;
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, displayName: user.displayName };
}
