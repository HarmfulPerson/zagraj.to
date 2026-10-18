"use client";

import { useActionState, useState } from "react";

import type { StatusFormState } from "@/app/panel/event-actions";
import { availableStatusActions, type EventStatus } from "@/lib/event-status";

type Props = {
  status: EventStatus;
  action: (prev: StatusFormState, formData: FormData) => Promise<StatusFormState>;
};

const DESCRIPTIONS: Record<EventStatus, string> = {
  DRAFT: "Wydarzenie jest szkicem. Goście nie mogą jeszcze dodawać życzeń. Rozpocznij je, gdy impreza się zaczyna.",
  LIVE: "Wydarzenie trwa. Goście mogą dodawać życzenia i głosować. Zakończ je po imprezie.",
  CLOSED: "Wydarzenie jest zakończone. Goście nie mogą już dodawać życzeń ani głosować.",
};

const primaryButton =
  "flex min-h-12 w-full items-center justify-center rounded-lg px-5 text-base font-semibold text-white shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 sm:w-auto";
const secondaryButton =
  "flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function EventStatusControls({ status, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirmClose, setConfirmClose] = useState(false);
  const actions = availableStatusActions(status);

  return (
    <div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{DESCRIPTIONS[status]}</p>
      {state.error ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      ) : null}
      {actions.length > 0 ? (
        <form action={formAction} className="mt-4">
          {actions.includes("start") ? (
            <button
              type="submit"
              name="action"
              value="start"
              disabled={pending}
              className={`${primaryButton} bg-emerald-700 hover:bg-emerald-800 focus-visible:outline-emerald-700`}
            >
              {pending ? "Uruchamianie…" : "Rozpocznij"}
            </button>
          ) : null}
          {actions.includes("close") && !confirmClose ? (
            <button type="button" onClick={() => setConfirmClose(true)} className={`${primaryButton} bg-zinc-900 hover:bg-zinc-700 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`}>
              Zakończ
            </button>
          ) : null}
          {actions.includes("close") && confirmClose ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm font-medium text-red-900 dark:text-red-200">
                Na pewno zakończyć wydarzenie? Tej operacji nie można cofnąć.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  name="action"
                  value="close"
                  disabled={pending}
                  className={`${primaryButton} bg-red-700 hover:bg-red-800 focus-visible:outline-red-700`}
                >
                  {pending ? "Kończenie…" : "Tak, zakończ"}
                </button>
                <button type="button" onClick={() => setConfirmClose(false)} className={`${secondaryButton} bg-white dark:bg-zinc-900`}>
                  Nie, wróć
                </button>
              </div>
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
