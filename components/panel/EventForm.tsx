"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { EventFormState } from "@/app/panel/event-actions";
import { FormField, SubmitButton } from "@/components/auth/FormField";
import { SUBSCRIPTION_PATH } from "@/lib/app";
import {
  EVENT_NAME_MAX_LENGTH,
  MAX_REQUESTS_PER_GUEST_DEFAULT,
  MAX_REQUESTS_PER_GUEST_MAX,
  MAX_REQUESTS_PER_GUEST_MIN,
} from "@/lib/event-validation";
import { PLAN_MESSAGES, POSTER_TEXT_MAX_LENGTH } from "@/lib/plans";

type EventFormProps = {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  mode: "create" | "edit";
  defaults?: { name: string; maxRequestsPerGuest: number; posterText?: string };
  /** Edit mode: the poster text is a Pro feature; a locked field is shown disabled (and so never submitted). */
  posterTextLocked?: boolean;
  cancelHref?: string;
};

const initialState: EventFormState = {};

export function EventForm({ action, mode, defaults, posterTextLocked = true, cancelHref }: EventFormProps) {
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
      {isCreate ? null : posterTextLocked ? (
        <LockedPosterText />
      ) : (
        <FormField
          name="posterText"
          label="Tekst na plakacie (opcjonalnie)"
          type="text"
          maxLength={POSTER_TEXT_MAX_LENGTH}
          autoComplete="off"
          placeholder="Np. Najlepsza para, najlepsza muzyka!"
          defaultValue={values?.posterText ?? defaults?.posterText ?? ""}
          error={errors.posterText}
          hint={`Do ${POSTER_TEXT_MAX_LENGTH} znaków. Pojawi się na plakacie pod hasłem „Zeskanuj i zamów piosenkę”.`}
        />
      )}
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

function LockedPosterText() {
  return (
    <div data-testid="poster-text-locked">
      <label htmlFor="field-posterText" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Tekst na plakacie
        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
          Pro
        </span>
      </label>
      <div className="relative">
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <input
          id="field-posterText"
          type="text"
          disabled
          aria-describedby="field-posterText-hint"
          placeholder="Własny tekst pod hasłem"
          className="block min-h-12 w-full cursor-not-allowed rounded-lg border border-dashed border-zinc-300 bg-zinc-50 py-2.5 pr-3.5 pl-11 text-base text-zinc-500 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
      </div>
      <p id="field-posterText-hint" className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        {PLAN_MESSAGES.posterTextLocked}.{" "}
        <Link href={SUBSCRIPTION_PATH} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
          {PLAN_MESSAGES.upgradeCta}
        </Link>
      </p>
    </div>
  );
}
