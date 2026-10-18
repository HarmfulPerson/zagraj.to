"use server";

import { redirect } from "next/navigation";

import { endDjSession, LOGIN_PATH, PANEL_PATH, startDjSession } from "@/lib/auth";
import { firstFieldErrors, loginSchema, registerSchema, type FieldErrors } from "@/lib/auth-validation";
import { authenticateDj, registerDj } from "@/lib/dj-accounts";

export type RegisterFormState = {
  fieldErrors?: FieldErrors<{ email: string; displayName: string; password: string }>;
  values?: { email: string; displayName: string };
};

export type LoginFormState = {
  formError?: string;
  fieldErrors?: FieldErrors<{ email: string; password: string }>;
  values?: { email: string };
};

const EMAIL_TAKEN_MESSAGE = "Konto z tym adresem e-mail już istnieje. Zaloguj się albo użyj innego adresu.";
const INVALID_CREDENTIALS_MESSAGE = "Nieprawidłowy e-mail lub hasło.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function registerAction(_prev: RegisterFormState, formData: FormData): Promise<RegisterFormState> {
  const raw = { email: text(formData, "email"), displayName: text(formData, "displayName"), password: text(formData, "password") };
  const values = { email: raw.email, displayName: raw.displayName };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error), values };

  const result = await registerDj(parsed.data);
  if (!result.ok) return { fieldErrors: { email: EMAIL_TAKEN_MESSAGE }, values };

  await startDjSession(result.dj.id);
  redirect(PANEL_PATH);
}

export async function loginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const raw = { email: text(formData, "email"), password: text(formData, "password") };
  const values = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error), values };

  const dj = await authenticateDj(parsed.data);
  if (!dj) return { formError: INVALID_CREDENTIALS_MESSAGE, values };

  await startDjSession(dj.id);
  redirect(PANEL_PATH);
}

export async function logoutAction(): Promise<void> {
  await endDjSession();
  redirect(LOGIN_PATH);
}
