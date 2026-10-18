import Link from "next/link";
import { Suspense } from "react";

import { logoutAction } from "@/app/auth-actions";
import { APP_NAME } from "@/lib/app";
import { requireDj } from "@/lib/auth";

async function DjMenu() {
  const dj = await requireDj();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="hidden truncate text-sm text-zinc-600 sm:inline dark:text-zinc-400" data-testid="dj-name">
        {dj.displayName}
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Wyloguj się
        </button>
      </form>
    </div>
  );
}

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 print:bg-white dark:bg-zinc-950">
      <header className="print:hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/panel" className="text-xl font-bold tracking-tight text-violet-700 dark:text-violet-400">
            {APP_NAME}
          </Link>
          <Suspense fallback={<div className="h-11 w-28 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />}>
            <DjMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
