---
id: "007"
title: Strona gościa i dodawanie życzeń
status: todo
depends_on: ["004", "006"]
attempts: 0
---

## Cel
Gość skanuje QR, wyszukuje utwór i dodaje go do listy, bez logowania.

## Kryteria akceptacji
- [ ] `/e/[code]`: nieznany kod daje stronę 404 po polsku; wydarzenie DRAFT pokazuje „Impreza jeszcze się nie zaczęła”, CLOSED pokazuje „Impreza zakończona”
- [ ] Przy pierwszej wizycie gość dostaje ciasteczko `guestId` (UUID, httpOnly, 30 dni)
- [ ] Wyszukiwarka z debounce (300 ms) korzystająca z `/api/search`
- [ ] `POST /api/events/[code]/requests` z utworem:
  - [ ] utworu nie ma na liście → tworzy Request (PENDING) i od razu głos dodającego
  - [ ] utwór już jest → nie tworzy duplikatu, tylko oddaje głos (jeśli gość jeszcze nie głosował)
  - [ ] przekroczony `maxRequestsPerGuest` → 429 z komunikatem; dodanie głosu na istniejący utwór nie zużywa limitu
  - [ ] `requestsOpen=false` lub status inny niż LIVE → 403
- [ ] Logika w `lib/requests.ts` z testami jednostkowymi wszystkich powyższych przypadków
- [ ] Widok mobilny (360 px) czytelny i wygodny

## Log
