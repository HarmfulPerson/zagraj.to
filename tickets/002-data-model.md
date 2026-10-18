---
id: "002"
title: Model danych i seed
status: done
depends_on: ["001"]
attempts: 1
---

## Cel
Schemat bazy zgodny z sekcją „Model danych” w SPEC.md.

## Kryteria akceptacji
- [x] Modele `User`, `Event`, `Request`, `Vote` z polami, relacjami i ograniczeniami unikalności ze SPEC
- [x] Enumy statusów i planów (w SQLite jako stringi z walidacją w kodzie, jeśli enumy nie są wspierane)
- [x] Migracja tworzy bazę od zera (`npx prisma migrate dev`)
- [x] `lib/db.ts` z singletonem PrismaClient (bezpieczny przy hot reload)
- [x] `lib/event-code.ts` generuje 6-znakowe kody bez znaków 0/O/1/I, z testem unikalności i alfabetu
- [x] Skrypt seed: 1 DJ (`dj@example.com` / `haslo1234`), 1 wydarzenie LIVE, kilka życzeń z głosami
- [x] Testy integracyjne na osobnej bazie testowej: unikalność (eventId, trackId) i (requestId, guestId)

## Log

### Developer (próba 1)
Zaimplementowano schemat zgodny z sekcją „Model danych” SPEC.md: modele `User`, `Event`, `Request`, `Vote` z relacjami (`onDelete: Cascade`), unikalnościami (`User.email`, `Event.code`, `Request(eventId, trackId)`, `Vote(requestId, guestId)`, dodatkowo unikalne `stripeCustomerId`/`stripeSubscriptionId`) i indeksami (`Event.djId`, `Request(eventId, createdByGuestId)` pod limit życzeń na gościa). Enumy `Plan`, `EventStatus`, `RequestStatus` jako natywne enumy Prismy: Prisma 7 wspiera je na SQLite (w bazie TEXT, walidacja w Prisma Client), a na Postgresie będą prawdziwymi typami enum, więc osobna walidacja stringów nie jest potrzebna (test integracyjny potwierdza odrzucenie wartości spoza enuma). Domyślne: `plan=FREE`, `status=DRAFT`/`PENDING`, `requestsOpen=true`, `maxRequestsPerGuest=5`.

- Migracja `prisma/migrations/20261018221635_init` (sprawdzone: `rm dev.db && npx prisma migrate dev` tworzy bazę od zera, `migrate status` czysty).
- `lib/db-client.ts`: fabryka `createPrismaClient(url?)` z adapterem `@prisma/adapter-better-sqlite3` (wymagany w Prisma 7), domyślny URL `file:./dev.db` lub `DATABASE_URL`.
- `lib/db.ts`: singleton `prisma` trzymany w `globalThis` poza produkcją (bezpieczny przy hot reload). Fabryka w osobnym pliku, żeby seed i testy nie tworzyły przy imporcie klienta dla dev.db.
- `lib/event-code.ts`: alfabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (bez 0/O/1/I), `generateEventCode()` (CSPRNG `crypto.randomInt`), `isValidEventCode`, `normalizeEventCode`, `generateUniqueEventCode(isTaken, maxAttempts=10)` z ponawianiem przy kolizji (do użycia w tickecie 004).
- Seed `prisma/seed.ts` (konfiguracja `migrations.seed: "tsx prisma/seed.ts"` w `prisma.config.ts`, uruchamianie `npx prisma db seed`): DJ `dj@example.com` / `haslo1234` (hash bcryptjs, koszt 10), wydarzenie LIVE „Wesele Ani i Tomka” z kodem `WESELE`, 5 życzeń w różnych statusach (PENDING/ACCEPTED/PLAYED z `playedAt`/REJECTED) i 11 głosów. Idempotentny (upsert DJ-a, odtworzenie wydarzenia) — sprawdzone dwukrotnym uruchomieniem.
- Testy: Vitest podzielony na projekty `unit` i `integration`. Integracyjne mają `DATABASE_URL=file:./test.db`, `globalSetup` usuwa `test.db` i odtwarza go `prisma migrate deploy`, a po testach kasuje; `fileParallelism: false`. `dev.db` nie jest dotykany (sprawdzone), `npm test` nie wymaga plików env.
- Zależności: `@prisma/adapter-better-sqlite3@7.10.1`, `better-sqlite3@^12` (zgodne z adapterem, bez duplikatu), `bcryptjs` (bcrypt w czystym JS, bez kompilacji natywnej; użyje go też ticket 003); dev: `tsx`, `@types/better-sqlite3`.

Pliki: `prisma/schema.prisma`, `prisma/migrations/20261018221635_init/migration.sql`, `prisma/migrations/migration_lock.toml`, `prisma/seed.ts`, `prisma.config.ts`, `lib/db.ts`, `lib/db-client.ts`, `lib/event-code.ts`, `vitest.config.mts`, `tests/unit/event-code.test.ts`, `tests/integration/global-setup.ts`, `tests/integration/db-constraints.test.ts`, `package.json`, `package-lock.json`, `.env.example` (tylko komentarz).

Testy:
- `tests/unit/event-code.test.ts` (9): alfabet bez 0/O/1/I i bez duplikatów, 500 kodów (prawdopodobieństwo przypadkowej kolizji ~1e-4, więc test nie jest niestabilny) — długość 6, tylko dozwolone znaki, brak kolizji, pokrycie całego alfabetu; walidacja/normalizacja; ponawianie przy kolizji i błąd po `maxAttempts`.
- `tests/integration/db-constraints.test.ts` (8, na `test.db`): P2002 dla duplikatu (eventId, trackId) i (requestId, guestId), ten sam utwór w dwóch wydarzeniach dozwolony, unikalny email i kod wydarzenia, wartości domyślne, odrzucenie statusu spoza enuma, kaskadowe usuwanie.
- `npm run check` ✅ (18/18 testów), `npm run e2e` ✅ (1/1), `npm run build` ✅, `rm dev.db && npx prisma migrate dev && npx prisma db seed` ✅, smoke singletonu `lib/db.ts` na dev.db (5 życzeń, 11 głosów) ✅.

### Tester (próba 1)
- `npm run check` ✅ — lint OK, typecheck OK, Vitest: 3 pliki, 18/18 testów (unit + integration).
- `npm run e2e` ✅ — 1/1 (`home.spec.ts`).
- Weryfikacja od zera ✅ — istniejący `dev.db` przeniesiony na bok, `npx prisma migrate dev` zastosował `20261018221635_init` („in sync”), `npx prisma db seed` → „Seed OK”, `migrate status` czysty. W bazie: 1 User (hash `$2b$…`), 1 Event LIVE, 5 Request, 11 Vote. Po testach `test.db` jest usuwany.

Kryteria:
- ✅ Modele `User`, `Event`, `Request`, `Vote` — `prisma/schema.prisma` i `migration.sql`: pola, opcjonalność, domyślne i unikalności 1:1 ze SPEC (`email`, `code`, `(eventId, trackId)`, `(requestId, guestId)`); relacje z `onDelete: Cascade`. Testy: domyślne wartości, unikalność email/kodu, kaskada.
- ✅ Enumy `Plan`, `EventStatus`, `RequestStatus` — natywne enumy Prismy (TEXT w SQLite, walidacja w kliencie); test „rejects status values outside the enum”.
- ✅ Migracja od zera — sprawdzone ręcznie (wyżej) oraz w `tests/integration/global-setup.ts` (`migrate deploy` na pustym `test.db` przy każdym uruchomieniu testów).
- ✅ `lib/db.ts` — singleton w `globalThis` poza produkcją; fabryka w `lib/db-client.ts`.
- ✅ `lib/event-code.ts` — alfabet bez 0/O/1/I, CSPRNG, 6 znaków; `tests/unit/event-code.test.ts` sprawdza alfabet, długość, unikalność 500 próbek, pokrycie alfabetu, walidację i ponawianie przy kolizji.
- ✅ Seed — `prisma/seed.ts`: `dj@example.com` / `haslo1234` (bcrypt), wydarzenie LIVE `WESELE`, 5 życzeń z 11 głosami; idempotentny.
- ✅ Testy integracyjne na osobnej bazie — projekt Vitest `integration` z `DATABASE_URL=file:./test.db`; test asertuje URL bazy; P2002 dla duplikatu (eventId, trackId) i (requestId, guestId) oraz pozytywne przypadki (ten sam utwór w innym wydarzeniu, inny gość).

Testy sprawdzają rzeczywiste zachowanie (asercje na kod błędu P2002 i liczności rekordów), żaden istniejący test nie został usunięty ani osłabiony (zmiana `include` → `projects` zachowuje `tests/unit/**`).

### Reviewer (próba 1)
Przejrzane: `git diff` (schema, `prisma.config.ts`, `vitest.config.mts`, `package.json`, `.env.example`) oraz nowe pliki (`lib/db*.ts`, `lib/event-code.ts`, `prisma/seed.ts`, migracja, testy). `scripts/ui-shots.mjs` i wpis `/ui-shots/` w `.gitignore` pominięte (dodane przez orkiestratora).

**Krytyczne:** brak.

**Drobne:**
- `stripeCustomerId`/`stripeSubscriptionId` mają `@unique`, czego SPEC nie wymienia — rozsądne (lookup z webhooków Stripe), ale to drobne wyjście poza literę SPEC; zostawić.
- Dodatkowe indeksy `Event(djId)` i `Request(eventId, createdByGuestId)` — OK, przydadzą się w ticketach z limitem życzeń i panelem.
- Przenośność na Postgresa: schemat przenośny (cuid, natywne enumy, brak typów specyficznych dla SQLite); `migration_lock.toml` i adapter `better-sqlite3` w `lib/db-client.ts` trzeba będzie wymienić przy migracji na Postgresa (nowa migracja bazowa) — oczekiwane, tylko do odnotowania.
- Seed wypisuje hasło demo w konsoli — akceptowalne dla danych deweloperskich.
- Checkboxy kryteriów w tickecie nie są odhaczone — do odhaczenia przy zamykaniu (DoD).
- Bezpieczeństwo: hasło w seedzie hashowane bcryptjs (koszt 10), brak sekretów w repo (`*.db` w `.gitignore`), brak API routes w tym tickecie. Generator kodów używa `crypto.randomInt`. Zakres zgodny z ticketem, bez scope creep.

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Ticket zamknięty.
