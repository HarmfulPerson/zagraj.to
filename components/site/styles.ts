/** Shared class names of the public site (dark, lime accent). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300";

export const primaryButton = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-base font-semibold text-zinc-950 shadow-[0_0_32px_-6px] shadow-lime-300/60 transition hover:bg-lime-200 ${focusRing}`;

export const secondaryButton = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold text-white ring-1 ring-white/25 transition ring-inset hover:bg-white/10 ${focusRing}`;
