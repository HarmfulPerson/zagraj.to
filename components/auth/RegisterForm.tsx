"use client";

import { useActionState } from "react";

import { registerAction, type RegisterFormState } from "@/app/auth-actions";
import { FormField, SubmitButton } from "@/components/auth/FormField";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-validation";

const initialState: RegisterFormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
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
      <FormField
        name="displayName"
        label="Nazwa wyświetlana"
        type="text"
        autoComplete="nickname"
        required
        defaultValue={state.values?.displayName}
        error={errors.displayName}
        hint="Np. DJ Marek. Zobaczą ją goście na Twoich wydarzeniach."
      />
      <FormField
        name="password"
        label="Hasło"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        error={errors.password}
        hint={`Co najmniej ${PASSWORD_MIN_LENGTH} znaków.`}
      />
      <SubmitButton pending={pending} pendingLabel="Zakładanie konta…">
        Załóż konto
      </SubmitButton>
    </form>
  );
}
