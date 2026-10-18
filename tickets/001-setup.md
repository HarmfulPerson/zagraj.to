---
id: "001"
title: Inicjalizacja projektu
status: todo
depends_on: []
attempts: 0
---

## Cel
Szkielet aplikacji Next.js z narzędziami, na których opiera się cała reszta.

## Kryteria akceptacji
- [ ] Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- [ ] ESLint skonfigurowany, `npm run lint` przechodzi
- [ ] Vitest z jednym przykładowym testem, `npm test` przechodzi
- [ ] Playwright skonfigurowany (uruchamia dev server), jeden test e2e strony głównej
- [ ] Prisma z SQLite (`DATABASE_URL` w `.env.example`), pusty schemat się generuje
- [ ] Skrypty w package.json: `dev`, `build`, `lint`, `typecheck`, `test`, `e2e`, `check` (lint + typecheck + test)
- [ ] `.gitignore` obejmuje `node_modules`, `.next`, `.env.local`, `*.db`, `logs/`, raporty Playwrighta
- [ ] Struktura katalogów: `app/`, `lib/`, `components/`, `tests/unit/`, `tests/e2e/`

## Uwagi
- `create-next-app` nie chce działać w niepustym katalogu. Wygeneruj projekt w katalogu tymczasowym i przenieś pliki albo skonfiguruj ręcznie. **Nie nadpisuj** `CLAUDE.md`, `SPEC.md`, `tickets/`, `.claude/`, `scripts/`, `README.md`.
- Przeglądarki Playwrighta: `npx playwright install chromium`.

## Log
