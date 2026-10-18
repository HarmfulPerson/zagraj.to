---
id: "002"
title: Model danych i seed
status: todo
depends_on: ["001"]
attempts: 0
---

## Cel
Schemat bazy zgodny z sekcją „Model danych” w SPEC.md.

## Kryteria akceptacji
- [ ] Modele `User`, `Event`, `Request`, `Vote` z polami, relacjami i ograniczeniami unikalności ze SPEC
- [ ] Enumy statusów i planów (w SQLite jako stringi z walidacją w kodzie, jeśli enumy nie są wspierane)
- [ ] Migracja tworzy bazę od zera (`npx prisma migrate dev`)
- [ ] `lib/db.ts` z singletonem PrismaClient (bezpieczny przy hot reload)
- [ ] `lib/event-code.ts` generuje 6-znakowe kody bez znaków 0/O/1/I, z testem unikalności i alfabetu
- [ ] Skrypt seed: 1 DJ (`dj@example.com` / `haslo1234`), 1 wydarzenie LIVE, kilka życzeń z głosami
- [ ] Testy integracyjne na osobnej bazie testowej: unikalność (eventId, trackId) i (requestId, guestId)

## Log
