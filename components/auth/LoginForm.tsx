"use client";

import { useActionState } from "react";

import { loginAction, type LoginFormState } from "@/app/auth-actions";
import { FormField, SubmitButton } from "@/components/auth/FormField";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.formError}
        </div>
      ) : null}
      <FormField
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={errors.email}
      />
      <FormField name="password" label="Hasło" type="password" autoComplete="current-password" required error={errors.password} />
      <SubmitButton pending={pending} pendingLabel="Logowanie…">
        Zaloguj się
      </SubmitButton>
    </form>
  );
}
