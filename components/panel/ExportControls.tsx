"use client";

import { useEffect, useId, useState } from "react";

import { DEFAULT_EXPORT_STATUSES, EXPORT_STATUS_ORDER, exportUrl, REQUEST_STATUS_LABELS } from "@/lib/export";
import type { RequestStatus } from "@/lib/request-status";

type Feedback = { tone: "ok" | "error"; text: string } | null;

const FEEDBACK_TIMEOUT_MS = 3000;
const COPY_FAILED = "Nie udało się skopiować listy.";

class ExportError extends Error {}

async function fetchList(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new ExportError("Brak połączenia. Sprawdź internet i spróbuj ponownie.");
  }
  if (!response.ok) throw new ExportError("Nie udało się pobrać listy. Odśwież stronę i spróbuj ponownie.");
  return response.text();
}

/**
 * Puts the list on the clipboard. The promise-based ClipboardItem keeps the click's user activation while the list
 * is still downloading (Safari refuses `writeText` after an `await`); browsers without it fall back to `writeText`.
 */
async function copyFrom(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    } catch (error) {
      await text; // A failed download explains the failure better than the clipboard error.
      if (!(error instanceof DOMException) || error.name === "NotAllowedError") throw error;
    }
  }
  await navigator.clipboard.writeText(await text);
}

/** "Eksport listy" on the event page: status filter, CSV download and copying the list as text. */
export function ExportControls({ eventId }: { eventId: string }) {
  const [statuses, setStatuses] = useState<RequestStatus[]>([...DEFAULT_EXPORT_STATUSES]);
  const [copying, setCopying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const headingId = useId();
  const nothingChosen = statuses.length === 0;

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const toggle = (status: RequestStatus) =>
    setStatuses((current) => (current.includes(status) ? current.filter((s) => s !== status) : [...current, status]));

  async function copyList() {
    if (copying || nothingChosen) return;
    setCopying(true);
    const text = fetchList(exportUrl(eventId, "txt", statuses));
    try {
      await copyFrom(text);
      const empty = (await text).trim() === "";
      setFeedback(empty ? { tone: "error", text: "Brak utworów o wybranych statusach." } : { tone: "ok", text: "Skopiowano" });
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof ExportError ? error.message : COPY_FAILED });
    } finally {
      setCopying(false);
    }
  }

  const downloadIcon = (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
  );
  const button =
    "flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500";

  return (
    <section
      aria-labelledby={headingId}
      data-testid="export-controls"
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Eksport listy
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Do playlisty w Spotify, rekordbox albo arkusza. Kolejność według głosów.</p>
          <fieldset className="mt-3">
            <legend className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Statusy</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPORT_STATUS_ORDER.map((status) => (
                <label
                  key={status}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-300 transition select-none ring-inset has-checked:bg-violet-600 has-checked:text-white has-checked:ring-violet-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-violet-400 dark:text-zinc-400 dark:ring-zinc-700 dark:has-checked:bg-violet-500/30 dark:has-checked:text-white dark:has-checked:ring-violet-400"
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={statuses.includes(status)}
                    onChange={() => toggle(status)}
                  />
                  <svg aria-hidden viewBox="0 0 24 24" className="hidden size-4 peer-checked:block" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                  {REQUEST_STATUS_LABELS[status]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          {nothingChosen ? (
            <span
              aria-disabled="true"
              className={`${button} cursor-not-allowed border border-dashed border-zinc-400 bg-transparent text-zinc-500 opacity-60 dark:border-zinc-600 dark:text-zinc-500`}
            >
              {downloadIcon}
              Pobierz CSV
            </span>
          ) : (
            <a href={exportUrl(eventId, "csv", statuses)} download className={`${button} bg-violet-700 text-white shadow-sm hover:bg-violet-800`}>
              {downloadIcon}
              Pobierz CSV
            </a>
          )}
          <button
            type="button"
            onClick={copyList}
            disabled={copying || nothingChosen}
            aria-disabled={nothingChosen || undefined}
            className={`${button} border border-zinc-300 bg-white text-zinc-800 enabled:hover:bg-zinc-100 disabled:cursor-wait aria-disabled:cursor-not-allowed aria-disabled:border-dashed aria-disabled:border-zinc-400 aria-disabled:bg-transparent aria-disabled:text-zinc-500 aria-disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:enabled:hover:bg-zinc-800 dark:aria-disabled:border-zinc-600 dark:aria-disabled:bg-transparent dark:aria-disabled:text-zinc-500`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </svg>
            {copying ? "Kopiuję…" : "Kopiuj listę"}
          </button>
        </div>
      </div>

      <p
        aria-live="polite"
        data-testid="export-feedback"
        className={`mt-3 min-h-5 text-sm font-medium ${nothingChosen || feedback?.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
      >
        {nothingChosen ? "Wybierz co najmniej jeden status." : (feedback?.text ?? "")}
      </p>
    </section>
  );
}
