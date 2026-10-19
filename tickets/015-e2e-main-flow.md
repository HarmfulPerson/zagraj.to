---
id: "015"
title: Test e2e scenariusza głównego
status: done
depends_on: ["011", "012", "014"]
attempts: 1
---

## Cel
Jeden test potwierdzający definicję „MVP gotowe” ze SPEC.md.

## Kryteria akceptacji
- [x] Test Playwright z dwoma kontekstami przeglądarki gości (różne ciasteczka) i kontekstem DJ-a:
  DJ rejestruje się → tworzy i rozpoczyna wydarzenie → gość A otwiera `/e/<code>`, wyszukuje i dodaje utwór → gość B lajkuje go → DJ widzi 2 głosy → oznacza utwór jako zagrany → gość A widzi go w sekcji „Zagrane”
- [x] Deezer zamockowany na poziomie sieci (`page.route`) lub przez zmienną środowiskową włączającą fake catalog
- [x] Test przechodzi stabilnie 3 razy z rzędu (`--repeat-each=3`)
- [x] README.md uzupełniony o sekcję „Uruchomienie aplikacji lokalnie” (instalacja, migracja, seed, dev)

## Log

### Developer (próba 1)

**Co zrobiłem**
- `tests/e2e/main-flow.spec.ts` (nowy): jeden test, trzy osobne konteksty przeglądarki (DJ na tablecie 1180×820, gość A i gość B na telefonie 360 px, osobne ciasteczka), dokładnie scenariusz ze SPEC, wszystko przez UI:
  1. DJ rejestruje się (`registerDj`, unikalny e-mail) → „Utwórz pierwsze wydarzenie” → formularz → status „Szkic” → „Rozpocznij” → status „Trwa”, kolumna „Nowe” pusta; kod odczytany z `event-code`.
  2. Gość A otwiera `/e/<code>`, wpisuje „abba” w „Szukaj utworu”, klika „Dodaj: Dancing Queen – ABBA”, widzi komunikat „Dodano…” i swój serduszko-głos.
  3. Gość B lajkuje „Polub: Dancing Queen – ABBA” (`clickAndWaitForSave` na `POST /api/requests/<id>/vote`), licznik 2.
  4. DJ widzi na tablicy w regionie „Nowe” kartę z `img` „2 głosy” (polling, timeout 15 s).
  5. DJ klika „Zagrane: Dancing Queen – ABBA” (`clickAndWaitForSave` na `POST …/status`), karta jest w regionie „Zagrane”.
  6. Gość A widzi utwór w regionie „Zagrane” z „2 głosy” (polling), a w „Lista życzeń” nie ma już jego przycisku polubienia.
- Lokatory: role/etykiety/tekst (regiony kolumn i sekcji przez `aria-labelledby`, przyciski z `aria-label`); test-id tylko dla kodu wydarzenia, statusu i komunikatu (brak lepszego uchwytu). Bez stałych `sleep`, czekanie na realne warunki.
- Deezer: mock sieciowy `page.route("**/api/search*")` z istniejącego `guestPage()` w `tests/e2e/guest-helpers.ts` (fake catalog w env nie istnieje; nie dublowałem). Helpery `registerDj`, `guestPage`, `clickAndWaitForSave` użyte ponownie, bez zmian.
- Opcjonalne zrzuty ekranu kluczowych momentów: tylko gdy ustawione `E2E_SCREENSHOT_DIR` (domyślnie nic nie jest zapisywane w repo).
- `README.md`: dopisana na końcu sekcja „Uruchomienie aplikacji lokalnie” (wymagania, `npm install`, `.env.local` i znaczenie zmiennych, `openssl rand -hex 32`, `npx prisma migrate dev`, `npx prisma db seed` z loginem demo i kodem WESELE, `npm run dev`, `npm run check`, `npx playwright install chromium` + `npm run e2e`, wskazanie kroków Stripe w Logu ticketu 012, test na telefonie w Wi-Fi). Istniejące sekcje bez zmian.

**Pliki**: `tests/e2e/main-flow.spec.ts` (nowy), `README.md` (nowa sekcja), `tickets/015-e2e-main-flow.md` (Log).

**Jak przetestowałem**
- `npx playwright test tests/e2e/main-flow.spec.ts --repeat-each=3`: uruchomione 3 razy → **9/9** zielone (~11–13 s na test).
- `npm run e2e` (pełne): **44/44** zielone. `npm run check`: lint + typecheck + Vitest **392/392** zielone.
- Zrzuty (w scratchpadzie, nie w repo) obejrzane: lista gościa A z „Dancing Queen” i znaczkiem „Twoje”; tablica DJ-a z kartą w „Nowe” z 2 głosami i przyciskami Akceptuj/Zagrane/Odrzuć; ekran gościa A z pustą listą życzeń i „Dancing Queen – 2 głosy” w sekcji „Zagrane”.
- **README zweryfikowany na czystej kopii repo** (rsync bez `node_modules`, `.env*`, `*.db`, `generated`; prawdziwego `.env.local` nie czytałem): `npm install` (generuje klienta Prisma) → `cp .env.example .env.local` + `openssl rand -hex 32` (64 znaki) → `npx prisma migrate dev` (tworzy `dev.db`) → `npx prisma db seed` („Seed OK: dj@example.com / haslo1234, event WESELE”) → `npm run dev` (200 na `/`, `/e/WESELE` z utworami z seeda, logowanie demo w przeglądarce → `/panel`) → `npm run check` (392/392) → `npx playwright install chromium` → test main-flow na porcie `E2E_PORT=3120` zielony.
- **Telefon w Wi-Fi**: sprawdzone Playwrightem przez adres LAN. Przy `npm run dev -- -H 0.0.0.0` strona ładuje się z IP, ale WebSocket HMR jest odrzucany (cross-origin względem hosta 0.0.0.0) i kliknięcie serduszka nie zapisało głosu. Przy `npm run dev -- -H <IP LAN>` HMR łączy się, głos zapisuje się (200), logowanie DJ-a działa; po ustawieniu `NEXT_PUBLIC_APP_URL="http://<IP>:<port>"` i restarcie QR koduje `http://<IP>:<port>/e/WESELE`. Dlatego README zaleca `-H <IP>` (zamiast sugerowanego `0.0.0.0`) i wyjaśnia dlaczego. Alternatywa na przyszłość (poza zakresem): `allowedDevOrigins` w `next.config.ts`.

**Definicja „MVP gotowe” (SPEC)**
- Scenariusz: DJ się rejestruje → tworzy wydarzenie → gość A dodaje utwór → gość B go lajkuje → DJ widzi 2 głosy → oznacza jako zagrany → gość widzi go w „Zagrane”: pokryty 1:1 przez `main-flow.spec.ts`, przechodzi stabilnie.
- Tickety 001–014 mają `status: done`; 015 (ten) czeka na tester/reviewer. Po jego zamknięciu definicja jest spełniona.
- Uwaga (nie blokuje): ręczny test z prawdziwym kontem Stripe nadal czeka na człowieka (ticket 012); w e2e Stripe nie jest potrzebny.

### Tester (próba 1)

**Wyniki**
- `npm run check`: lint + typecheck + Vitest **392/392** zielone.
- `npx playwright test tests/e2e/main-flow.spec.ts --repeat-each=3`: **3/3** zielone (~11 s każdy).
- `npm run e2e` (pełne): **44/44** zielone.
- Weryfikacja README na świeżym `git clone` lokalnego repo (w scratchpadzie, z nowym README): `npm install` (postinstall generuje klienta Prisma) → `cp .env.example .env.local` + `openssl rand -hex 32` jako `SESSION_SECRET` → `npx prisma migrate dev` (tworzy `dev.db`) → `npx prisma db seed` („Seed OK: dj@example.com / haslo1234, event WESELE (LIVE), 5 requests”) → `npm run build` OK.

**Kryteria akceptacji**
- ✅ Test Playwright z trzema kontekstami: DJ (`page` z fixture) + gość A i gość B przez `guestPage(browser)` → każdy to `browser.newContext()`, więc osobne ciasteczka. Kolejność kroków 1:1 ze SPEC i ticketem: rejestracja przez formularz (`registerDj`) → utworzenie wydarzenia przez UI („Utwórz pierwsze wydarzenie”, formularz, status „Szkic”) → „Rozpocznij” (status „Trwa”) → gość A otwiera `/e/<code>`, wpisuje „abba”, klika „Dodaj: Dancing Queen – ABBA” → gość B klika „Polub…” (czekanie na `POST …/vote` 2xx, licznik „2”) → DJ widzi na karcie w regionie „Nowe” `img` „2 głosy” → DJ klika „Zagrane…” (czekanie na `POST …/status` 2xx), karta w „Zagrane” → gość A widzi utwór w regionie „Zagrane” z „2 głosy”, a przycisk polubienia zniknął z listy życzeń. Kroki scenariusza idą wyłącznie przez UI (helpery API `createEvent*` nie są używane). Brak stałych `sleep`/`waitForTimeout`, czekanie na warunki (`expect` z timeoutem 15 s dla pollingu). Asercje sensowne (konkretne regiony, liczby głosów, `aria-pressed`, odpowiedzi serwera).
- ✅ Deezer zamockowany sieciowo: `page.route("**/api/search*")` w `guestPage()` (`tests/e2e/guest-helpers.ts`), stały katalog `TRACKS`.
- ✅ Stabilność: `--repeat-each=3` → 3/3 (u developera 9/9), dodatkowo w pełnym przebiegu równolegle z innymi testami.
- ✅ README: `git diff README.md` to wyłącznie dopisana na końcu sekcja „Uruchomienie aplikacji lokalnie” (instalacja, `.env.local`, migracja, seed, dev, dane demo, testy, Stripe, telefon w Wi-Fi). Wszystkie zmienne z `.env.example` (`DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`) opisane. Komendy sprawdzone na świeżym klonie (wyżej). Komunikat „Blocked cross-origin request…” istnieje w Next.js (`block-cross-site-dev.js`), więc wyjaśnienie `-H <IP LAN>` jest zgodne z rzeczywistością.

**Definicja „MVP gotowe”**: tickety 001–014 mają `status: done` (`grep -H '^status:' tickets/*.md`), test scenariusza głównego przechodzi.

Wynik: **PASS**

### Reviewer (próba 1)

Zakres zmian: `tests/e2e/main-flow.spec.ts` (nowy), `README.md` (tylko dopisana sekcja), `tickets/015-e2e-main-flow.md` (frontmatter + Log). Kod aplikacji i konfiguracja bez zmian, żaden istniejący test nie został usunięty ani osłabiony.

**Krytyczne**
- Brak.

**Bezpieczeństwo / zgodność**
- Test nie zawiera sekretów, nie czyta `.env.local`; Stripe niepotrzebny, Deezer zamockowany (zgodnie z CLAUDE.md p. 3). Zrzuty ekranu tylko przy jawnym `E2E_SCREENSHOT_DIR`, domyślnie nic nie trafia do repo.
- README nie ujawnia sekretów, każe generować `SESSION_SECRET` i nie commitować `.env.local`. Teksty po polsku, kod/komentarze po angielsku.
- Zakres zgodny z ticketem: brak zmian poza testem i README.

**Jakość**
- Test czytelny, ponownie używa istniejących helperów (`registerDj`, `guestPage`, `clickAndWaitForSave`) zamiast je dublować; lokatory oparte na rolach/etykietach; czekanie na odpowiedzi serwera tam, gdzie kolejne kroki zależą od stanu po stronie serwera.

**Drobne (na później)**
- README: „Node.js 20+” jest nieco nieprecyzyjne; Prisma 7 wymaga `^20.19 || ^22.12 || >=24`, Next `>=20.9`. Warto napisać „Node.js 20.19+ (lub 22.12+)”.
- Konteksty gości są zamykane na końcu testu; przy porażce w środku zamknie je dopiero Playwright przy sprzątaniu `browser` (akceptowalne, ewentualnie `try/finally`).
- Rozważyć `allowedDevOrigins` w `next.config.ts` w osobnym tickecie, żeby `-H 0.0.0.0` też działało (wspomniane przez developera).

Wynik: **APPROVE**

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Doprecyzowano wymaganą wersję Node w README (Prisma 7). Wszystkie tickety 001–015 mają status done.
