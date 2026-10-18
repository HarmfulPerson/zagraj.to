---
id: "008"
title: Lajki i lista dla gości
status: todo
depends_on: ["007"]
attempts: 0
---

## Cel
Goście widzą listę życzeń na żywo i lajkują utwory.

## Kryteria akceptacji
- [ ] `GET /api/events/[code]/requests` zwraca życzenia PENDING i ACCEPTED posortowane po liczbie głosów (malejąco), potem po dacie, oraz osobno ostatnie 20 PLAYED. REJECTED nigdy nie trafia do gościa.
- [ ] Każde życzenie ma `votes`, `votedByMe` i `mine` (dodane przez tego gościa)
- [ ] `POST` / `DELETE /api/requests/[id]/vote` dodaje i usuwa głos; podwójny głos jest niemożliwy (test)
- [ ] Lajkowanie działa także przy `requestsOpen=false`, ale nie w wydarzeniu CLOSED
- [ ] UI: przycisk serca z licznikiem, optymistyczna aktualizacja, odznaka „Twoje”, sekcja „Zagrane”
- [ ] Odświeżanie listy co 3 s (SWR)
- [ ] Testy jednostkowe sortowania i ukrywania REJECTED

## Log
