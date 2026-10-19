"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";

import { ConnectionBanner, useOnline } from "@/components/ConnectionBanner";
import { BoardCard } from "@/components/panel/board/BoardCard";
import { useNewHighlights } from "@/components/panel/board/useNewHighlights";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { boardIds, moveBoardItem } from "@/lib/board-view";
import type { BoardItem, DjBoard as DjBoardData } from "@/lib/dj-board";
import { polishPlural } from "@/lib/plans";
import { availableRequestActions, type RequestStatus } from "@/lib/request-status";

/** The board is refreshed this often while the event is LIVE (SPEC: polling every 3 s). */
export const BOARD_REFRESH_MS = 3000;
const NOTICE_TIMEOUT_MS = 5000;
const ACTION_FAILED_MESSAGE = "Nie udało się zapisać zmiany. Spróbuj ponownie.";
const OFFLINE_MESSAGE = "Brak połączenia. Sprawdź internet i spróbuj ponownie.";

type Props = {
  eventId: string;
  name: string;
  code: string;
  initialBoard: DjBoardData;
  /** Server-rendered event management (details, QR, start/close, edit), shown in a collapsible section. */
  manage: ReactNode;
};

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return fallback;
}

async function fetchBoard(url: string): Promise<DjBoardData> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status, "Nie udało się odświeżyć tablicy.");
  return (await response.json()) as DjBoardData;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response, ACTION_FAILED_MESSAGE));
  return response.json();
}

// "5 min temu" ticks every 15 s; on the server and during hydration there is no clock (null), so no mismatch.
const NOW_STEP_MS = 15_000;
const subscribeNow = (onChange: () => void) => {
  const timer = setInterval(onChange, NOW_STEP_MS);
  return () => clearInterval(timer);
};
const getNow = () => Math.floor(Date.now() / NOW_STEP_MS) * NOW_STEP_MS;
const getServerNow = () => null;

type ColumnConfig = { status: RequestStatus; title: string; empty: string; accent: string; muted?: boolean };

const MAIN_COLUMNS: ColumnConfig[] = [
  { status: "PENDING", title: "Nowe", empty: "Brak nowych życzeń. Pojawią się tu same.", accent: "bg-amber-400" },
  { status: "ACCEPTED", title: "Zaakceptowane", empty: "Zaakceptuj życzenie, żeby trafiło tutaj.", accent: "bg-emerald-400" },
  { status: "PLAYED", title: "Zagrane", empty: "Nic jeszcze nie zagrano.", accent: "bg-violet-400", muted: true },
];

export function DjBoard({ eventId, name, code, initialBoard, manage }: Props) {
  const router = useRouter();
  const key = `/api/events/${eventId}/board`;
  const serverStatus = initialBoard.event.status;
  const {
    data: board = initialBoard,
    error,
    mutate,
  } = useSWR(key, fetchBoard, {
    fallbackData: initialBoard,
    // Only a LIVE party changes on its own; a DRAFT or CLOSED board is static.
    refreshInterval: (latest) => ((latest ?? initialBoard).event.status === "LIVE" ? BOARD_REFRESH_MS : 0),
    revalidateOnFocus: serverStatus === "LIVE",
    revalidateOnMount: serverStatus === "LIVE",
    keepPreviousData: true,
  });

  // A fresh server render (after start/close/edit) is the newest truth.
  useEffect(() => {
    void mutate(initialBoard, { revalidate: false });
  }, [initialBoard, mutate]);

  // The event was started or closed elsewhere (another device): re-render the page around the board.
  const status = board.event.status;
  useEffect(() => {
    if (status !== serverStatus) router.refresh();
  }, [status, serverStatus, router]);

  const live = status === "LIVE";
  const online = useOnline();
  const connectionLost = !online || error !== undefined;
  const now = useSyncExternalStore(subscribeNow, getNow, getServerNow);
  const { isNew, newCount, dismiss } = useNewHighlights(eventId, boardIds(board));
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());
  const [togglePending, setTogglePending] = useState(false);
  const [manageOpen, setManageOpen] = useState(serverStatus === "DRAFT");
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const noticeId = useRef(0);
  const manageId = useId();
  const rejectedId = useId();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const showError = (text: string) => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, text });
  };

  const setItemPending = (id: string, on: boolean) => {
    if (on) pendingRef.current.add(id);
    else pendingRef.current.delete(id);
    setPending(new Set(pendingRef.current));
  };

  /** A board action, applied at once and rolled back if the server refuses. */
  async function act(item: BoardItem, to: RequestStatus) {
    if (pendingRef.current.has(item.id)) return;
    setItemPending(item.id, true);
    dismiss(item.id);
    try {
      await mutate(
        async (current) => {
          const { item: saved } = (await postJson(`/api/requests/${item.id}/status`, { status: to })) as { item: BoardItem };
          return moveBoardItem(current ?? board, saved.id, saved.status, saved.playedAt ? new Date(saved.playedAt) : new Date());
        },
        {
          optimisticData: (current) => moveBoardItem(current ?? board, item.id, to, new Date()),
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch (failure) {
      showError(failure instanceof ApiError ? failure.message : ACTION_FAILED_MESSAGE);
      // Someone else changed it meanwhile (409) or it is gone (404): show the current board.
      void mutate();
    } finally {
      setItemPending(item.id, false);
    }
  }

  async function toggleRequests() {
    if (togglePending) return;
    const next = !board.event.requestsOpen;
    const withOpen = (current: DjBoardData | undefined, requestsOpen: boolean): DjBoardData => {
      const base = current ?? board;
      return { ...base, event: { ...base.event, requestsOpen } };
    };
    setTogglePending(true);
    try {
      await mutate(
        async (current) => {
          const result = (await postJson(`/api/events/${eventId}/requests-open`, { requestsOpen: next })) as { requestsOpen: boolean };
          return withOpen(current, result.requestsOpen);
        },
        { optimisticData: (current) => withOpen(current, next), rollbackOnError: true, revalidate: false },
      );
    } catch (failure) {
      showError(failure instanceof ApiError ? failure.message : ACTION_FAILED_MESSAGE);
    } finally {
      setTogglePending(false);
    }
  }

  const actionsFor = (item: BoardItem) => (live ? availableRequestActions(item.status) : []);
  const rejected = board.columns.REJECTED;

  const renderCard = (item: BoardItem, muted: boolean) => (
    <BoardCard
      key={item.id}
      item={item}
      actions={actionsFor(item)}
      isNew={isNew(item.id)}
      pending={pending.has(item.id)}
      now={now}
      muted={muted}
      onAction={act}
    />
  );

  return (
    <div data-testid="dj-board" data-event-status={status}>
      <header className="sticky top-0 z-20 -mx-3 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-72 items-center gap-2.5">
            <Link
              href="/panel"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-violet-300 ring-1 ring-zinc-800 transition ring-inset hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-violet-400 xl:px-3 xl:text-sm"
            >
              ←<span className="sr-only xl:not-sr-only xl:ml-1.5">{" "}Wszystkie wydarzenia</span>
            </Link>
            <h1 className="min-w-0 truncate text-xl font-bold tracking-tight text-white sm:text-2xl" title={name}>
              {name}
            </h1>
            <StatusBadge status={status} />
            <span className="hidden shrink-0 rounded-lg bg-zinc-900 px-2 py-1 font-mono text-sm font-bold tracking-[0.15em] text-violet-300 ring-1 ring-zinc-800 ring-inset lg:inline">
              {code}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {live ? <LiveIndicator connectionLost={connectionLost} newCount={newCount} /> : <ConnectionBanner show={!online} variant="inline" />}
            {status !== "CLOSED" ? (
              <RequestsSwitch open={board.event.requestsOpen} pending={togglePending} onToggle={toggleRequests} />
            ) : null}
            <button
              type="button"
              aria-expanded={manageOpen}
              aria-controls={manageId}
              onClick={() => setManageOpen((open) => !open)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800 transition ring-inset hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-violet-400"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="10" cy="17" r="2" />
              </svg>
              Wydarzenie i QR
              <svg aria-hidden viewBox="0 0 24 24" className={`size-4 transition ${manageOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div id={manageId} hidden={!manageOpen} className="mt-3">
        {manage}
      </div>

      {status === "DRAFT" ? (
        <p className="mt-3 rounded-2xl border border-dashed border-zinc-700 px-4 py-6 text-center text-base text-zinc-300">
          Tablica ruszy, gdy rozpoczniesz wydarzenie. Do tego czasu goście nie mogą dodawać życzeń.
        </p>
      ) : null}
      {status === "CLOSED" ? (
        <p className="mt-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-zinc-400 ring-1 ring-zinc-800 ring-inset">
          Wydarzenie zakończone. Tablica jest tylko do podglądu.
        </p>
      ) : null}

      {status !== "DRAFT" ? (
        <>
          <div className="mt-3 grid items-start gap-3 md:grid-cols-3 lg:gap-4">
            {MAIN_COLUMNS.map((column) => {
              const items = board.columns[column.status];
              return (
                <section
                  key={column.status}
                  aria-labelledby={`col-${column.status}`}
                  data-testid={`column-${column.status}`}
                  className="min-w-0"
                >
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <span aria-hidden className={`size-2.5 rounded-full ${column.accent}`} />
                    <h2 id={`col-${column.status}`} className="text-base font-bold tracking-wide text-zinc-200 uppercase">
                      {column.title}
                    </h2>
                    <span data-testid="column-count" className="ml-auto rounded-full bg-zinc-800 px-2.5 py-0.5 text-sm font-bold text-zinc-200 tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-400">{column.empty}</p>
                  ) : (
                    <ol className="space-y-2">{items.map((item) => renderCard(item, column.muted ?? false))}</ol>
                  )}
                </section>
              );
            })}
          </div>

          <details className="group mt-4 rounded-2xl bg-zinc-900/50 ring-1 ring-zinc-800 ring-inset" data-testid="column-REJECTED">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 select-none [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="size-2.5 rounded-full bg-red-400" />
              <h2 id={rejectedId} className="text-base font-bold tracking-wide text-zinc-300 uppercase">
                Odrzucone
              </h2>
              <span data-testid="column-count" className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-sm font-bold text-zinc-300 tabular-nums">
                {rejected.length}
              </span>
              <span className="ml-auto text-sm text-zinc-400 group-open:hidden">Pokaż</span>
              <span className="ml-auto hidden text-sm text-zinc-400 group-open:inline">Ukryj</span>
            </summary>
            <div className="px-3 pb-3">
              {rejected.length === 0 ? (
                <p className="px-1 pb-1 text-sm text-zinc-400">Nic nie odrzucono.</p>
              ) : (
                <ol aria-labelledby={rejectedId} className="grid gap-2 md:grid-cols-3">
                  {rejected.map((item) => renderCard(item, true))}
                </ol>
              )}
            </div>
          </details>
        </>
      ) : null}

      {notice ? (
        <div
          key={notice.id}
          role="alert"
          data-testid="board-notice"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-xl bg-red-950 px-4 py-3 text-base font-medium text-red-100 shadow-lg ring-1 ring-red-800"
        >
          {notice.text}
        </div>
      ) : null}
    </div>
  );
}

/** Scrolls the first highlighted request into view (it may be far down a long "Nowe" column). */
function showFirstNew() {
  document.querySelector('[data-new="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function LiveIndicator({ connectionLost, newCount }: { connectionLost: boolean; newCount: number }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-live="polite">
        {newCount > 0 ? (
          <button
            type="button"
            data-testid="new-count"
            onClick={showFirstNew}
            title="Pokaż nowe życzenie"
            className="min-h-10 rounded-full bg-amber-400 px-3 text-sm font-black text-zinc-950 tabular-nums transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            {newCount} {polishPlural(newCount, "nowe", "nowe", "nowych")} <span aria-hidden>↓</span>
          </button>
        ) : null}
      </span>
      <ConnectionBanner show={connectionLost} variant="inline" />
      {connectionLost ? null : (
        <span className="hidden items-center gap-1.5 text-sm text-zinc-400 lg:inline-flex">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-400" />
          Na żywo
        </span>
      )}
    </div>
  );
}

function RequestsSwitch({ open, pending, onToggle }: { open: boolean; pending: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      disabled={pending}
      onClick={onToggle}
      data-testid="requests-open-switch"
      className={`inline-flex min-h-12 items-center gap-3 rounded-xl px-3 text-left ring-1 transition ring-inset focus-visible:outline-2 focus-visible:outline-violet-400 disabled:cursor-wait ${
        open ? "bg-emerald-500/10 ring-emerald-500/40" : "bg-amber-400/10 ring-amber-400/50"
      }`}
    >
      <span
        aria-hidden
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${open ? "bg-emerald-500" : "bg-zinc-700"}`}
      >
        <span className={`size-6 rounded-full bg-white shadow transition ${open ? "translate-x-5.5" : "translate-x-0.5"}`} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-white">Zgłoszenia otwarte</span>
        <span className={`text-xs font-medium [@media(max-height:500px)]:hidden ${open ? "text-emerald-300" : "text-amber-300"}`}>
          {open ? "Goście dodają utwory" : "Tylko głosowanie"}
        </span>
      </span>
    </button>
  );
}
