"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import { Brand } from "@/components/guest/Brand";
import { GuestRequestList } from "@/components/guest/GuestRequestList";
import { Cover, TrackText } from "@/components/guest/TrackParts";
import type { Track } from "@/lib/catalog/types";
import { PLAN_MESSAGES } from "@/lib/plans";
import type { GuestList, GuestListItem } from "@/lib/guest-list";
import type { AddRequestOutcome, GuestRequest } from "@/lib/requests";

export const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const NOTICE_TIMEOUT_MS = 4500;
/** The wish list is refreshed this often (SPEC: polling every 3 s, SSE/WebSockets after MVP). */
export const LIST_REFRESH_MS = 3000;

const OFFLINE_MESSAGE = "Brak połączenia z internetem. Sprawdź zasięg i spróbuj ponownie.";
const SEARCH_FAILED_MESSAGE = "Nie udało się wyszukać utworów. Spróbuj ponownie za chwilę.";
const ADD_FAILED_MESSAGE = "Nie udało się dodać utworu. Spróbuj ponownie.";
const VOTE_FAILED_MESSAGE = "Nie udało się zapisać głosu. Spróbuj ponownie.";

type SearchResult = { query: string; tracks: Track[]; error: string | null };
type Notice = { id: number; kind: "success" | "info" | "error"; text: string };
/** What happened to a track the guest tapped in this visit. */
type TrackState = "pending" | "added" | "voted";

type Props = {
  code: string;
  name: string;
  maxRequests: number;
  initialUsed: number;
  initialList: GuestList;
};

type VoteResponse = { votes: number; votedByMe: boolean };

/** A failed API call with the HTTP status and the (Polish) message from the response. */
class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function fetchList(url: string): Promise<GuestList> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response, "Nie udało się odświeżyć listy."));
  return (await response.json()) as GuestList;
}

/** Applies `update` to one request in the queue (votes only change there; played tracks have no hearts). */
function patchItem(list: GuestList, id: string, update: (item: GuestListItem) => GuestListItem): GuestList {
  return { ...list, queue: list.queue.map((item) => (item.id === id ? update(item) : item)) };
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return fallback;
}

export function GuestEventLive({ code, name, maxRequests, initialUsed, initialList }: Props) {
  const router = useRouter();
  const listKey = `/api/events/${code}/requests`;
  const {
    data: list = initialList,
    error: listError,
    mutate: mutateList,
  } = useSWR(listKey, fetchList, {
    fallbackData: initialList,
    refreshInterval: LIST_REFRESH_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const pendingVotes = useRef(new Set<string>());
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [trackStates, setTrackStates] = useState<Record<string, TrackState>>({});
  const [used, setUsed] = useState(initialUsed);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_QUERY_LENGTH;
  const listFull = list.event.requestsOpen && list.event.listFull;
  const canAdd = list.event.requestsOpen && !listFull;
  const eventStatus = list.event.status;

  // The DJ closed the party (or the event is otherwise no longer LIVE): re-render the page with its message.
  useEffect(() => {
    if (eventStatus !== "LIVE") router.refresh();
  }, [eventStatus, router]);

  // Debounced search: waits 300 ms after the last keystroke; a newer query aborts the older request.
  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) {
          const error = await errorMessage(response, SEARCH_FAILED_MESSAGE);
          setResult({ query: trimmed, tracks: [], error });
          return;
        }
        const body = (await response.json()) as { tracks: Track[] };
        setResult({ query: trimmed, tracks: body.tracks, error: null });
      } catch {
        if (!controller.signal.aborted) setResult({ query: trimmed, tracks: [], error: OFFLINE_MESSAGE });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, retryToken]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const noticeCounter = useRef(0);
  const show = (kind: Notice["kind"], text: string) => {
    noticeCounter.current += 1;
    setNotice({ id: noticeCounter.current, kind, text });
  };

  async function add(track: Track) {
    setTrackStates((states) => ({ ...states, [track.id]: "pending" }));
    const reset = () =>
      setTrackStates((states) => {
        const next = { ...states };
        delete next[track.id];
        return next;
      });
    let response: Response;
    try {
      response = await fetch(`/api/events/${code}/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ track }),
      });
    } catch {
      reset();
      show("error", OFFLINE_MESSAGE);
      return;
    }

    if (response.ok) {
      const body = (await response.json()) as { outcome: AddRequestOutcome; request: GuestRequest; usedRequests: number };
      setUsed(body.usedRequests);
      void mutateList();
      if (body.outcome === "CREATED") {
        setTrackStates((states) => ({ ...states, [track.id]: "added" }));
        show("success", `Dodano „${body.request.title}”. DJ już to widzi!`);
      } else {
        setTrackStates((states) => ({ ...states, [track.id]: "voted" }));
        show(
          "info",
          body.outcome === "VOTED"
            ? `„${body.request.title}” już jest na liście. Dodaliśmy Twój głos.`
            : `Już głosujesz na „${body.request.title}”.`,
        );
      }
      return;
    }

    reset();
    const message = await errorMessage(response, ADD_FAILED_MESSAGE);
    if (response.status === 429) setUsed((current) => Math.max(current, maxRequests));
    // Requests closed or the party ended meanwhile: the fresh list switches to the banner or the page to its message.
    if (response.status === 403) void mutateList();
    // Already played (or rejected): refresh, so a played track shows up in "Zagrane". List full: the banner replaces the search.
    if (response.status === 409) void mutateList();
    show("error", message);
  }

  /** Optimistic like/unlike: the heart and counter change at once and roll back if the server refuses. */
  async function toggleVote(item: GuestListItem) {
    if (pendingVotes.current.has(item.id)) return;
    pendingVotes.current.add(item.id);
    const like = !item.votedByMe;
    const vote = async (current: GuestList | undefined): Promise<GuestList> => {
      const response = await fetch(`/api/requests/${item.id}/vote`, {
        method: like ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) throw new ApiError(response.status, await errorMessage(response, VOTE_FAILED_MESSAGE));
      const result = (await response.json()) as VoteResponse;
      return patchItem(current ?? list, item.id, (it) => ({ ...it, votes: result.votes, votedByMe: result.votedByMe }));
    };
    try {
      await mutateList(vote, {
        optimisticData: (current) =>
          patchItem(current ?? list, item.id, (it) =>
            it.votedByMe === like ? it : { ...it, votedByMe: like, votes: Math.max(0, it.votes + (like ? 1 : -1)) },
          ),
        rollbackOnError: true,
        revalidate: false,
      });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      show("error", error instanceof ApiError ? error.message : OFFLINE_MESSAGE);
      // The request was rejected, played or the party ended meanwhile: fetch the current list (and page).
      if (status === 404 || status === 409) void mutateList();
      if (status === 403) router.refresh();
    } finally {
      pendingVotes.current.delete(item.id);
    }
  }

  const mineIds = new Set([...list.queue, ...list.played].filter((item) => item.mine).map((item) => item.trackId));
  const stateOf = (track: Track): TrackState | undefined => trackStates[track.id] ?? (mineIds.has(track.id) ? "added" : undefined);
  const limitReached = used >= maxRequests;
  const remaining = Math.max(0, maxRequests - used);
  const loading = searching && result?.query !== trimmed;
  const shownResult = searching ? result : null;
  const requestList = (
    <GuestRequestList list={list} stale={listError !== undefined} requestsOpen={canAdd} onToggleVote={toggleVote} />
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-5 pb-32">
      <header>
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/25 ring-inset">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Na żywo
          </span>
        </div>
        <h1 data-testid="guest-event-name" className="mt-5 text-2xl leading-tight font-bold tracking-tight break-words text-white">
          {name}
        </h1>
        <p className="mt-1.5 text-base text-zinc-300">
          {canAdd
            ? "Zaproponuj piosenkę albo polub propozycje innych gości."
            : "Polub utwory, które chcesz usłyszeć. DJ widzi, czego chce sala."}
        </p>

        {canAdd ? (
          <div className="mt-4 rounded-2xl bg-zinc-900 px-4 py-3 ring-1 ring-zinc-800" data-testid="guest-usage">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-200">Twoje życzenia</span>
              <span className="font-semibold text-zinc-100 tabular-nums">
                {Math.min(used, maxRequests)} z {maxRequests}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-label="Wykorzystane życzenia"
              aria-valuemin={0}
              aria-valuemax={maxRequests}
              aria-valuenow={Math.min(used, maxRequests)}
            >
              <div
                className={`h-full rounded-full transition-all ${limitReached ? "bg-amber-400" : "bg-gradient-to-r from-violet-500 to-fuchsia-500"}`}
                style={{ width: `${Math.min(100, (used / maxRequests) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {limitReached
                ? "Limit wykorzystany. Możesz dalej dodawać głosy na utwory, które już są na liście."
                : `Możesz dodać jeszcze ${remaining}.`}
            </p>
          </div>
        ) : listFull ? (
          <div role="status" data-testid="guest-list-full" className="mt-4 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/30">
            <p className="font-semibold">{PLAN_MESSAGES.listFull}</p>
            <p className="mt-0.5 text-amber-100/80">{PLAN_MESSAGES.listFullDetails}</p>
          </div>
        ) : (
          <div role="status" data-testid="guest-requests-closed" className="mt-4 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/30">
            <p className="font-semibold">DJ chwilowo nie przyjmuje nowych życzeń.</p>
            <p className="mt-0.5 text-amber-100/80">Możesz dalej lajkować utwory z listy.</p>
          </div>
        )}
      </header>

      {canAdd ? (
        <>
          <div ref={searchBarRef} className="sticky top-0 z-10 -mx-4 mt-4 bg-zinc-950/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
            <form role="search" onSubmit={(event) => { event.preventDefault(); inputRef.current?.blur(); }}>
              <label htmlFor="guest-search" className="sr-only">
                Szukaj utworu
              </label>
              <div className="relative">
                <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  ref={inputRef}
                  id="guest-search"
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={100}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  // Bring the search bar to the top, so results are not hidden behind the phone keyboard.
                  onBlur={() => setSearchFocused(false)}
                  onFocus={() => {
                    setSearchFocused(true);
                    requestAnimationFrame(() => searchBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                  placeholder="Tytuł lub wykonawca"
                  className="h-14 w-full rounded-2xl bg-zinc-900 pr-14 pl-12 text-base text-white ring-1 ring-zinc-700 transition outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-violet-400 [&::-webkit-search-cancel-button]:hidden"
                />
                {loading ? (
                  <span aria-hidden className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-300" />
                ) : query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    aria-label="Wyczyść wyszukiwanie"
                    className="absolute top-1/2 right-1.5 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-zinc-400 hover:text-white"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          {/* While focused or searching, the area is at least a screen tall, so the search bar can scroll to the top. */}
          <section aria-label="Wyniki wyszukiwania" aria-busy={loading} className={searching || searchFocused ? "mt-1 min-h-dvh" : ""}>
            {!searching ? (
              <>
                {trimmed.length > 0 ? (
                  <p className="px-1 py-3 text-sm text-zinc-400">Wpisz co najmniej {MIN_QUERY_LENGTH} znaki.</p>
                ) : null}
                {requestList}
              </>
            ) : loading && !shownResult?.tracks.length ? (
              <ResultsSkeleton />
            ) : shownResult?.error ? (
              <div role="alert" data-testid="search-error" className="mt-2 rounded-2xl bg-red-500/10 px-4 py-4 text-sm text-red-100 ring-1 ring-red-400/30">
                <p>{shownResult.error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setRetryToken((token) => token + 1);
                  }}
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-red-400/15 px-4 font-semibold text-red-50 hover:bg-red-400/25"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : shownResult && shownResult.tracks.length === 0 ? (
              <div className="px-2 py-10 text-center">
                <p className="text-base font-semibold text-zinc-100">Nic nie znaleźliśmy</p>
                <p className="mt-1 text-sm break-words text-zinc-400">
                  Brak wyników dla „{shownResult.query}”. Sprawdź pisownię albo wpisz samego wykonawcę.
                </p>
              </div>
            ) : shownResult ? (
              <ul className={`divide-y divide-zinc-800/70 transition-opacity ${loading ? "opacity-60" : ""}`} data-testid="search-results">
                {shownResult.tracks.map((track) => (
                  <TrackRow key={track.id} track={track} state={stateOf(track)} onAdd={() => add(track)} />
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : null}

      {!canAdd ? requestList : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div aria-live="polite" role="status" className="w-full max-w-lg">
          {notice ? (
            <div
              key={notice.id}
              data-testid="guest-notice"
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3.5 text-[0.95rem] leading-snug font-medium shadow-2xl shadow-black/60 ring-1 ${
                notice.kind === "error"
                  ? "bg-zinc-900 text-red-100 ring-red-400/40"
                  : notice.kind === "success"
                    ? "bg-zinc-900 text-emerald-50 ring-emerald-400/40"
                    : "bg-zinc-900 text-violet-50 ring-violet-400/40"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold text-zinc-950 ${
                  notice.kind === "error" ? "bg-red-400" : notice.kind === "success" ? "bg-emerald-400" : "bg-violet-300"
                }`}
              >
                {notice.kind === "error" ? "!" : "✓"}
              </span>
              <span className="min-w-0 flex-1 break-words">{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Zamknij komunikat"
                className="-my-2.5 -mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-zinc-400 hover:text-white"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function TrackRow({ track, state, onAdd }: { track: Track; state: TrackState | undefined; onAdd: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5" data-testid="search-result">
      <Cover url={track.coverUrl} />
      <TrackText title={track.title} artist={track.artist} durationSec={track.durationSec} />
      {state === "added" || state === "voted" ? (
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-emerald-300">
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          {state === "added" ? "Dodano" : "Twój głos"}
        </span>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={state === "pending"}
          aria-label={`Dodaj: ${track.title} – ${track.artist}`}
          className="inline-flex min-h-11 min-w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 active:scale-95 disabled:opacity-70"
        >
          {state === "pending" ? (
            <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            "Dodaj"
          )}
        </button>
      )}
    </li>
  );
}

function ResultsSkeleton() {
  return (
    <ul aria-hidden className="divide-y divide-zinc-800/70">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-2.5">
          <div className="size-14 shrink-0 animate-pulse rounded-xl bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800/70" />
          </div>
          <div className="h-11 w-[5.5rem] animate-pulse rounded-full bg-zinc-800" />
        </li>
      ))}
    </ul>
  );
}
