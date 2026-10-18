---
id: "001"
title: Inicjalizacja projektu
status: done
depends_on: []
attempts: 1
---

## Cel
Szkielet aplikacji Next.js z narzędziami, na których opiera się cała reszta.

## Kryteria akceptacji
- [x] Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- [x] ESLint skonfigurowany, `npm run lint` przechodzi
- [x] Vitest z jednym przykładowym testem, `npm test` przechodzi
- [x] Playwright skonfigurowany (uruchamia dev server), jeden test e2e strony głównej
- [x] Prisma z SQLite (`DATABASE_URL` w `.env.example`), pusty schemat się generuje
- [x] Skrypty w package.json: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `check` (lint + typecheck + test)
- [x] `.gitignore` obejmuje `node_modules`, `.next`, `.env.local`, `*.db`, `logs/`, raporty Playwrighta
- [x] Struktura katalogów: `app/`, `lib/`, `components/`, `tests/unit/`, `tests/e2e/`

## Uwagi
- `create-next-app` nie chce działać w niepustym katalogu. Wygeneruj projekt w katalogu tymczasowym i przenieś pliki albo skonfiguruj ręcznie. **Nie nadpisuj** `CLAUDE.md`, `SPEC.md`, `tickets/`, `.claude/`, `scripts/`, `README.md`.
- Przeglądarki Playwrighta: `npx playwright install chromium`.

## Log

### Developer (próba 1)
Szkielet wygenerowany `create-next-app` (Next.js 16.4, App Router, TS strict, Tailwind 4, ESLint) w katalogu tymczasowym i przeniesiony bez nadpisywania plików projektu. Dodano Vitest 5 (+ `tests/unit/example.test.ts`), Playwright (webServer `npm run dev` na porcie 3100, `tests/e2e/home.spec.ts`), Prisma 7.10 z SQLite (pusty schemat, klient w `generated/prisma`, `prisma.config.ts` czyta `.env.local`/`.env`), `.env.example`, skrypty npm (`typecheck` = `next typegen && tsc --noEmit`, `postinstall` = `prisma generate`). Strona główna po polsku (`lang="pl"`). Usunięto skille agentów dodane automatycznie przez `prisma init` (spoza zakresu).

Pliki: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `prisma.config.ts`, `prisma/schema.prisma`, `.env.example`, `.gitignore`, `AGENTS.md` (generowany przez Next.js), `app/*`, `lib/app.ts`, `components/.gitkeep`, `tests/unit/example.test.ts`, `tests/e2e/home.spec.ts`.

Testy: `npm run check` ✅, `npm run e2e` ✅, `npm run build` ✅.

### Tester (próba 1)
- `npm run check`: ✅ (lint OK, `next typegen && tsc --noEmit` OK, Vitest 1/1 passed)
- `npm run e2e`: ✅ (Playwright 1/1 passed, `tests/e2e/home.spec.ts`, dev server startowany przez `webServer` na porcie 3100)
- `npx prisma validate` / `npx prisma generate`: ✅ (schemat poprawny, klient wygenerowany do `./generated/prisma`)

Kryteria:
- ✅ Next.js (App Router) + TypeScript strict + Tailwind: `app/layout.tsx`, `app/page.tsx`, `tsconfig.json` (`"strict": true`), `app/globals.css` (`@import "tailwindcss"`), klasy Tailwinda w komponentach.
- ✅ ESLint: `eslint.config.mjs` (next core-web-vitals + typescript), `npm run lint` przechodzi.
- ✅ Vitest: `vitest.config.mts`, test `tests/unit/example.test.ts` (sprawdza realną wartość `APP_NAME`), `npm test` przechodzi.
- ✅ Playwright: `playwright.config.ts` z `webServer: npm run dev`, test strony głównej sprawdza tytuł, `lang="pl"` i nagłówek h1.
- ✅ Prisma + SQLite: `prisma/schema.prisma` (provider sqlite, bez modeli), `prisma.config.ts`, `DATABASE_URL="file:./dev.db"` w `.env.example`; generowanie działa.
- ✅ Skrypty: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `check` (= lint && typecheck && test) w `package.json`.
- ✅ `.gitignore`: potwierdzone `git check-ignore -v` dla `node_modules`, `.next`, `.env.local`, `*.db` (także `prisma/dev.db`), `logs/`, `test-results/`, `playwright-report/`, `blob-report/`; `.env.example` NIE jest ignorowany (`!.env.example`).
- ✅ Struktura: `app/`, `lib/` (`lib/app.ts`), `components/` (`.gitkeep`), `tests/unit/`, `tests/e2e/`.
- ✅ Nienadpisane pliki: `git diff` na śledzonych plikach pokazuje tylko zmianę frontmattera tego ticketu; `CLAUDE.md`, `SPEC.md`, `README.md`, `tickets/`, `.claude/`, `scripts/` bez zmian.

### Reviewer (próba 1)
**Krytyczne:** brak.
- Brak sekretów w kodzie; `.env.local` ignorowany, `.env.example` zawiera tylko `DATABASE_URL` dla SQLite.
- Teksty UI po polsku (`lang="pl"`, tagline po polsku). Brak API routes w tym tickecie.

**Drobne:**
- `.gitignore`: martwy wpis `/app/generated/prisma` (pozostałość po szablonie; klient generuje się do `/generated/`, który jest osobno ignorowany) — do usunięcia przy okazji.
- `AGENTS.md` dodany automatycznie przez `next dev` — spoza zakresu ticketu, ale nieszkodliwy; zdecydować, czy commitować.
- `next.config.ts`: włączone `cacheComponents` i `partialPrefetching` oraz ręczna reguła turbopack dla Tailwinda (`@tailwindcss/turbopack`) — wykraczają poza minimalny szkielet; warto potwierdzić, że to świadoma decyzja, i dodać kiedyś test e2e/wizualny, że style Tailwinda faktycznie się ładują.
- `tsconfig.tsbuildinfo` i `next-env.d.ts` są ignorowane — OK.

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Usunięto zbędną linię `/app/generated/prisma` z `.gitignore` (uwaga drobna reviewera). Ticket zamknięty.
