"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { unseenIds } from "@/lib/board-view";

/** How long a newly arrived request stays highlighted, unless the DJ acts on it sooner. */
export const NEW_HIGHLIGHT_MS = 90_000;

const storageKey = (eventId: string) => `zagrajto:board-seen:${eventId}`;

/** Ids remembered on this device for the event, or null when the board was never opened here (or storage is off). */
function readSeen(eventId: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(storageKey(eventId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === "string")) : null;
  } catch {
    return null;
  }
}

function writeSeen(eventId: string, ids: readonly string[]) {
  try {
    window.localStorage.setItem(storageKey(eventId), JSON.stringify(ids));
  } catch {
    // Private mode or full storage: highlights still work for this visit.
  }
}

/**
 * Requests that appeared since the DJ last saw the board. Seen ids are remembered per event in localStorage,
 * so a request that arrived while the tablet was asleep (or the page was reloaded) is highlighted too.
 * A highlight ends after `NEW_HIGHLIGHT_MS` or when the DJ acts on the request (`dismiss`).
 */
export function useNewHighlights(eventId: string, ids: readonly string[]) {
  const [fresh, setFresh] = useState<ReadonlyMap<string, number>>(new Map());
  const seen = useRef<Set<string> | null | undefined>(undefined);
  const idsKey = ids.join(",");

  useEffect(() => {
    if (seen.current === undefined) seen.current = readSeen(eventId);
    const currentIds = idsKey === "" ? [] : idsKey.split(",");
    const arrived = unseenIds(currentIds, seen.current);
    seen.current = new Set([...(seen.current ?? []), ...currentIds]);
    writeSeen(eventId, [...seen.current]);
    if (arrived.length === 0) return;
    const expiresAt = Date.now() + NEW_HIGHLIGHT_MS;
    setFresh((previous) => new Map([...previous, ...arrived.map((id) => [id, expiresAt] as const)]));
  }, [eventId, idsKey]);

  useEffect(() => {
    if (fresh.size === 0) return;
    const next = Math.min(...fresh.values());
    const timer = setTimeout(
      () => setFresh((previous) => new Map([...previous].filter(([, expiresAt]) => expiresAt > Date.now()))),
      Math.max(0, next - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [fresh]);

  const dismiss = useCallback((id: string) => {
    setFresh((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  return { isNew: (id: string) => fresh.has(id), newCount: fresh.size, dismiss };
}
