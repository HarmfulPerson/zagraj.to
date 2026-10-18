"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
    >
      Drukuj
    </button>
  );
}
