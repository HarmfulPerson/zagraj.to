---
id: "011"
title: Limity planów Free i Pro
status: todo
depends_on: ["010"]
attempts: 0
---

## Cel
Plan użytkownika realnie ogranicza funkcje zgodnie z sekcją „Plany” w SPEC.md.

## Kryteria akceptacji
- [ ] `lib/plans.ts` jako jedno źródło prawdy o limitach (`getPlanLimits(plan)`, `canStartEvent(user)`, `canExport(user)` itd.)
- [ ] Free: drugie uruchomienie wydarzenia (DRAFT → LIVE) w tym samym miesiącu kalendarzowym jest blokowane z komunikatem i linkiem do `/panel/subskrypcja`
- [ ] Free: po 100 życzeniach w wydarzeniu goście dostają komunikat „Lista jest pełna”; lajkowanie dalej działa
- [ ] Free: eksport zablokowany po stronie API (403) i UI (przycisk z kłódką i opisem)
- [ ] Pro: brak tych limitów
- [ ] Testy jednostkowe wszystkich limitów, w tym granic miesiąca

## Log
