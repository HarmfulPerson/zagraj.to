import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 12;

/** Hashes a password with bcrypt. `rounds` is configurable only to keep tests fast. */
export function hashPassword(password: string, rounds: number = BCRYPT_ROUNDS): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
