"use client";

import { GuestMessage, WarningIcon } from "@/components/guest/GuestMessage";
import { type ErrorBoundaryProps, useLogError } from "@/components/errors/useLogError";

/** Unexpected error on the guest page (dark, like the rest of it). */
export default function GuestError({ error, retry }: ErrorBoundaryProps) {
  useLogError(error);
  return (
    <GuestMessage icon={WarningIcon} title="Coś poszło nie tak" testId="error-boundary">
      <p>Nie udało się wczytać listy życzeń. Sprawdź zasięg i spróbuj ponownie.</p>
      <button
        type="button"
        onClick={retry}
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-violet-600 px-6 text-base font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
      >
        Spróbuj ponownie
      </button>
    </GuestMessage>
  );
}
