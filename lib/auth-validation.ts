import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignores everything after 72 bytes, so longer passwords are rejected. */
export const PASSWORD_MAX_BYTES = 72;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 50;

const EMAIL_ERROR = "Podaj poprawny adres e-mail.";

/** Trims and lowercases, so "  Dj@Example.com " and "dj@example.com" are the same account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeEmail(value) : value),
  z.email({ error: EMAIL_ERROR }).max(254, { error: EMAIL_ERROR }),
);

export const registerSchema = z.object({
  email: emailSchema,
  displayName: z
    .string({ error: "Podaj nazwę wyświetlaną." })
    .trim()
    .min(DISPLAY_NAME_MIN_LENGTH, { error: `Nazwa wyświetlana musi mieć co najmniej ${DISPLAY_NAME_MIN_LENGTH} znaki.` })
    .max(DISPLAY_NAME_MAX_LENGTH, { error: `Nazwa wyświetlana może mieć najwyżej ${DISPLAY_NAME_MAX_LENGTH} znaków.` }),
  password: z
    .string({ error: "Podaj hasło." })
    .min(PASSWORD_MIN_LENGTH, { error: `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.` })
    .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, {
      error: "Hasło jest za długie (maksymalnie 72 znaki).",
    }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Podaj hasło." }).min(1, { error: "Podaj hasło." }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** First error message per field, ready to show next to the input. */
export function firstFieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const result: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof T | undefined;
    if (field !== undefined && result[field] === undefined) {
      result[field] = issue.message;
    }
  }
  return result;
}
