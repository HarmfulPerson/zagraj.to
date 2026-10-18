import { randomInt } from "node:crypto";

/** Uppercase letters and digits without the confusable characters 0, O, 1 and I. */
export const EVENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const EVENT_CODE_LENGTH = 6;

const EVENT_CODE_PATTERN = new RegExp(`^[${EVENT_CODE_ALPHABET}]{${EVENT_CODE_LENGTH}}$`);

/** Generates a random event code, e.g. "K7QX2M". Uses a CSPRNG. */
export function generateEventCode(): string {
  let code = "";
  for (let i = 0; i < EVENT_CODE_LENGTH; i++) {
    code += EVENT_CODE_ALPHABET[randomInt(EVENT_CODE_ALPHABET.length)];
  }
  return code;
}

/** Checks whether a string is a well-formed event code (case-sensitive). */
export function isValidEventCode(code: string): boolean {
  return EVENT_CODE_PATTERN.test(code);
}

/** Normalizes user input (trims, uppercases) so "k7qx2m " matches "K7QX2M". */
export function normalizeEventCode(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Generates a code that is not yet taken, retrying on collision.
 * `isTaken` usually checks the database, e.g. `(code) => prisma.event.findUnique(...)`.
 */
export async function generateUniqueEventCode(
  isTaken: (code: string) => Promise<boolean> | boolean,
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateEventCode();
    if (!(await isTaken(code))) return code;
  }
  throw new Error(`Could not generate a unique event code after ${maxAttempts} attempts`);
}
