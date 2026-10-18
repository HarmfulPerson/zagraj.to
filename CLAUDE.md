# CLAUDE.md — zasady projektu ZagrajTo

Pełny opis produktu i decyzji technicznych jest w `SPEC.md`. Przeczytaj go przed każdą pracą.

## Język
- UI i teksty dla użytkownika: **po polsku**
- Kod, nazwy zmiennych, commity: **po angielsku**
- Tickety i raporty: po polsku

## Komendy (dostępne po tickecie 001)
- `npm run dev` serwer deweloperski
- `npm run lint` ESLint
- `npm run typecheck` `tsc --noEmit`
- `npm test` Vitest
- `npm run e2e` Playwright
- `npm run check` = lint + typecheck + test (**musi przechodzić przed zamknięciem ticketu**)

## Tickety
Każdy ticket to plik `tickets/NNN-nazwa.md` z frontmatterem:

```
---
id: "007"
title: Strona gościa
status: todo        # todo | in-progress | done | blocked | needs-human
depends_on: ["002", "006"]
attempts: 0
---
```

Pod frontmatterem: **Cel**, **Kryteria akceptacji** (checklista), **Uwagi** oraz sekcja **Log**, do której agenci dopisują raporty (nigdy ich nie kasują).

- `needs-human`: ticket wymaga czegoś, czego agent nie zrobi (klucze API, konto, decyzja biznesowa). Agent opisuje w Logu, czego dokładnie potrzebuje.
- `blocked`: 3 nieudane próby. Czeka na człowieka.

## Zasady pracy
1. **Jeden ticket naraz.** Nie ruszaj kodu niezwiązanego z bieżącym ticketem.
2. Nowa logika = nowe testy. Logika biznesowa (limity, głosy, deduplikacja, plany) ma testy jednostkowe.
3. Zewnętrzne API (Deezer, Stripe) zawsze mockuj w testach. Testy nie mogą wymagać internetu ani kluczy.
4. Każde API route sprawdza autoryzację (DJ może modyfikować tylko swoje wydarzenia) i waliduje wejście zod-em.
5. Sekrety tylko w `.env.local` (nie commitować). Nowe zmienne dopisuj do `.env.example`.
6. **Nie usuwaj ani nie osłabiaj testów** tylko po to, żeby przeszły.
7. Nie zmieniaj `SPEC.md`. Zmiany zakresu zgłasza planner w nowym tickecie albo w Logu.
8. Nigdy nie rób `git push`. Commituje tylko orkiestrator po zamknięciu ticketu.

## Definition of Done
- Wszystkie kryteria akceptacji odhaczone
- `npm run check` przechodzi
- Tester dał PASS, reviewer nie zgłosił problemów krytycznych
- Ticket ma `status: done` i krótki wpis w Logu: co zrobiono i jakie pliki zmieniono
