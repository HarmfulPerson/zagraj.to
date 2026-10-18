"use client";

import { useEffect, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

const LABELS: Record<CopyState, string> = {
  idle: "Kopiuj link",
  copied: "Skopiowano!",
  failed: "Nie udało się skopiować",
};

export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <span aria-live="polite">{LABELS[state]}</span>
    </button>
  );
}
