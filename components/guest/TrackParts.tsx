"use client";

import { useEffect, useRef, useState } from "react";

/** Building blocks shared by search results and the wish list on the guest page. */

export function formatDuration(sec: number | null): string | null {
  if (sec === null || sec <= 0) return null;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

type CoverStatus = "loading" | "loaded" | "failed";

/**
 * A track cover with a music-note placeholder. The note is always rendered underneath, and the image is only revealed
 * once it has really loaded; one that fails (expired CDN link, offline, 404) is removed, so a broken-image icon never shows.
 *
 * The list is server-rendered, so the image may finish (or fail) before React hydrates and attaches `onLoad`/`onError`.
 * The mount effect reads the element's state to catch those early events. Reusable wherever a track cover is shown.
 */
export function Cover({ url, size = "md" }: { url: string | null; size?: "md" | "sm" }) {
  // Keyed on the url: a new cover starts from "loading" again.
  const [state, setState] = useState<{ url: string | null; status: CoverStatus }>({ url, status: "loading" });
  const status: CoverStatus = state.url === url ? state.status : "loading";
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return; // Still loading (or lazily deferred): onLoad/onError will fire after hydration.
    setState({ url, status: img.naturalWidth > 0 ? "loaded" : "failed" });
  }, [url]);

  const box = size === "md" ? "size-14 rounded-xl" : "size-11 rounded-lg";
  return (
    <div
      data-testid="track-cover"
      data-cover-status={url === null ? "none" : status}
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-zinc-800 text-zinc-500 ${box}`}
    >
      <svg
        aria-hidden
        data-testid="cover-fallback"
        viewBox="0 0 24 24"
        className={size === "md" ? "size-6" : "size-5"}
        fill="currentColor"
      >
        <path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V5.6a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 18 3.35v11.15a2.5 2.5 0 1 1-2-2.45V6.03l-7 1.75z" />
      </svg>
      {url !== null && status !== "failed" ? (
        // Deezer covers are small fixed-size thumbnails; next/image optimisation would only add latency here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={url}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          onLoad={() => setState({ url, status: "loaded" })}
          onError={() => setState({ url, status: "failed" })}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-200 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}
    </div>
  );
}

export function TrackText({ title, artist, durationSec }: { title: string; artist: string; durationSec: number | null }) {
  const duration = formatDuration(durationSec);
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[0.95rem] font-semibold text-white" title={title}>
        {title}
      </p>
      <p className="truncate text-sm text-zinc-400">
        {artist}
        {duration ? <span className="text-zinc-400"> · {duration}</span> : null}
      </p>
    </div>
  );
}
