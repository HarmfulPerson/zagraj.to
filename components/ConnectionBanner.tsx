"use client";

import { useSyncExternalStore } from "react";

export const CONNECTION_LOST_MESSAGE = "Brak połączenia, próbuję ponownie…";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser reports a network connection. SWR stops polling while offline (no request, so no error),
 * so pages combine this with the SWR error to notice a lost connection at once. Server render: assumed online.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

type Props = {
  /** Offline or the last refresh failed. SWR retries on its own and refetches when the browser is back online. */
  show: boolean;
  /** "toast": pill with a shadow for a floating area (guest page, above notices); "inline": a chip in a toolbar (DJ board). */
  variant?: "toast" | "inline";
};

/** Non-intrusive notice that live data cannot be refreshed right now; disappears by itself once a refresh succeeds. */
export function ConnectionBanner({ show, variant = "toast" }: Props) {
  const content = show ? (
    <span
      data-testid="connection-banner"
      className={`inline-flex items-center gap-2 rounded-full bg-amber-950 font-semibold text-amber-100 ring-1 ring-amber-400/50 ring-inset ${
        variant === "toast" ? "px-4 py-2.5 text-sm shadow-2xl shadow-black/60" : "px-3 py-1.5 text-sm"
      }`}
    >
      <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-200" />
      {CONNECTION_LOST_MESSAGE}
    </span>
  ) : null;

  // The live region stays mounted, so screen readers announce the message when it appears.
  return (
    <span role="status" aria-live="polite" className={variant === "toast" ? "flex justify-center" : undefined}>
      {content}
    </span>
  );
}
