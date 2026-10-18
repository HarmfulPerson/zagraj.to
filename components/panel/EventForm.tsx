"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { EventFormState } from "@/app/panel/event-actions";
import { FormField, SubmitButton } from "@/components/auth/FormField";
import {
  EVENT_NAME_MAX_LENGTH,
  MAX_REQUESTS_PER_GUEST_DEFAULT,
  MAX_REQUESTS_PER_GUEST_MAX,
  MAX_REQUESTS_PER_GUEST_MIN,
} from "@/lib/event-validation";

type EventFormProps = {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  mode: "create" | "edit";
  defaults?: { name: string; maxRequestsPerGuest: number };
  cancelHref?: string;
};

const initialState: EventFormState = {};

export function EventForm({ action, mode, defaults, cancelHref }: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  const values = state.values;
  const isCreate = mode === "create";

  return (
    // key: remount with fresh defaults after a successful save (the page re-renders with saved data).
    <form key={state.savedAt ?? "form"} action={formAction} className="space-y-5" noValidate>
      <FormField
        name="name"
        label="Nazwa wydarzenia"
        type="text"
        required
        maxLength={EVENT_NAME_MAX_LENGTH}
        autoComplete="off"
        placeholder={isCreate ? "Np. Wesele Ani i Tomka" : undefined}
        defaultValue={values?.name ?? defaults?.name}
        error={errors.name}
      />
      {isCreate ? (
        <FormField
          name="startsAt"
          label="Data (opcjonalnie)"
          type="date"
          defaultValue={values?.startsAt}
          error={errors.startsAt}
        />
      ) : null}
      <FormField
        name="maxRequestsPerGuest"
        label="Limit życzeń na gościa"
        type="number"
        inputMode="numeric"
        min={MAX_REQUESTS_PER_GUEST_MIN}
        max={MAX_REQUESTS_PER_GUEST_MAX}
        step={1}
        required
        defaultValue={values?.maxRequestsPerGuest ?? defaults?.maxRequestsPerGuest ?? MAX_REQUESTS_PER_GUEST_DEFAULT}
        error={errors.maxRequestsPerGuest}
        hint={`Od ${MAX_REQUESTS_PER_GUEST_MIN} do ${MAX_REQUESTS_PER_GUEST_MAX}. Tyle utworów może dodać jeden gość.`}
      />
      {state.savedAt ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Zmiany zapisane.
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {cancelHref ? (
          <Link
            href={cancelHref}
            className="flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Anuluj
          </Link>
        ) : null}
        <div className="sm:w-auto sm:min-w-48">
          <SubmitButton pending={pending} pendingLabel={isCreate ? "Tworzenie…" : "Zapisywanie…"}>
            {isCreate ? "Utwórz wydarzenie" : "Zapisz zmiany"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
