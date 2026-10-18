---
id: "006"
title: Wyszukiwarka utworów (Deezer)
status: done
depends_on: ["001"]
attempts: 1
---

## Cel
Endpoint wyszukiwania utworów, z którego korzysta strona gościa.

## Kryteria akceptacji
- [x] `lib/catalog/` z interfejsem `TrackCatalog` (`search(query): Promise<Track[]>`) i implementacją Deezer. Interfejs pozwoli później dodać inne źródła.
- [x] `Track`: id, title, artist, coverUrl, durationSec
- [x] `GET /api/search?q=...`: zapytanie 2–100 znaków (zod), max 15 wyników
- [x] Rate limit 20 zapytań na minutę na guestId (w pamięci, z interfejsem do późniejszej wymiany na Redis); przekroczenie zwraca 429 z komunikatem po polsku
- [x] Cache w pamięci identycznych zapytań na 5 minut
- [x] Błąd lub timeout Deezera (5 s) zwraca 502 z czytelnym komunikatem, bez stack trace
- [x] Testy z zamockowanym `fetch`: mapowanie odpowiedzi, rate limit, cache, obsługa błędu

## Log

### Developer (próba 1)
**Co zrobiłem**
- `lib/catalog/`: interfejs `TrackCatalog` + typ `Track` (`id`, `title`, `artist`, `coverUrl | null`, `durationSec | null`) i `CatalogError` (`types.ts`); `DeezerCatalog` (`deezer.ts`) woła `https://api.deezer.com/search?q=...&limit=15` z `AbortSignal.timeout(5000)`, waliduje odpowiedź zod-em i mapuje (`album.cover_medium` → `coverUrl`, `duration` → `durationSec`). Każdy błąd (sieć, timeout, status ≠ 2xx, niepoprawny JSON, odpowiedź Deezera `{ error: ... }` z HTTP 200, np. przekroczona quota) → `CatalogError`. `CachedCatalog` (`cached-catalog.ts`) to dekorator dowolnego katalogu z cache na 5 min; klucz = zapytanie po trim, scaleniu spacji i lowercase; błędy nie są cache'owane.
- `lib/cache.ts` (`Cache<T>` + `MemoryCache`, limit 1000 wpisów, usuwa wygasłe/najstarsze) i `lib/rate-limit.ts` (`RateLimiter` + `MemoryRateLimiter`, okno stałe, czyszczenie wygasłych kluczy). Oba interfejsy są asynchroniczne, żeby dało się je podmienić na Redis; zegar wstrzykiwany (`lib/clock.ts`).
- `lib/search.ts`: schemat zod `q` (trim, 2–100 znaków, komunikaty po polsku), `createSearchHandler(deps)` (wstrzykiwane katalog i limiter) oraz `createDefaultSearchDeps()` (Deezer + cache 5 min + 20 zapytań/min). `app/api/search/route.ts` eksportuje `GET` zbudowany z domyślnych zależności. Route czyta URL/nagłówki, więc przy `cacheComponents` jest dynamiczny (`next build` pokazuje `ƒ /api/search`).
- Odpowiedzi: 200 `{ tracks: Track[] }` (max 15); 400 `{ error: "VALIDATION", fieldErrors: { q } }` (wspólny `validationError` z `lib/api-responses.ts`); 429 `{ error: "RATE_LIMITED", message: "Za dużo wyszukiwań. Odczekaj chwilę i spróbuj ponownie." }` + nagłówek `Retry-After`; 502 `{ error: "CATALOG_UNAVAILABLE", message: "Wyszukiwarka utworów jest chwilowo niedostępna. Spróbuj ponownie za chwilę." }`, bez stack trace ani szczegółów błędu.
- Kolejność: walidacja → rate limit → katalog. Niepoprawne zapytania nie zużywają limitu; trafienia w cache go zużywają (limit dotyczy zapytań gościa, nie wywołań Deezera).
- **guestId:** ciasteczko formalnie wprowadza ticket 007. Nazwa jest we wspólnej stałej `GUEST_ID_COOKIE_NAME = "guestId"` w `lib/guest.ts`, żeby 007 jej użył. Klucz limitu: `guest:<guestId>` z ciasteczka, gdy brak to `ip:<pierwszy adres z x-forwarded-for>` (albo `x-real-ip`), w ostateczności wspólny kubełek `"anonymous"`. Do 007 gość może obejść limit, zmieniając ciasteczko. Limiter i cache żyją w pamięci jednego procesu, więc na wielu instancjach potrzebny będzie Redis.

**Zmienione/nowe pliki**
- `lib/catalog/types.ts`, `lib/catalog/deezer.ts`, `lib/catalog/cached-catalog.ts`
- `lib/cache.ts`, `lib/rate-limit.ts`, `lib/clock.ts`, `lib/guest.ts`, `lib/search.ts`
- `app/api/search/route.ts`
- `tests/unit/catalog.test.ts`, `tests/unit/cache.test.ts`, `tests/unit/rate-limit.test.ts`, `tests/unit/search-api.test.ts`

**Jak testowałem**
- Testy jednostkowe z zamockowanym `fetch` (bez sieci): mapowanie odpowiedzi i limit 15, błędy (HTTP 500, body `{error}`, niepoprawny JSON, błąd sieci, timeout), cache (5 min, normalizacja, brak cache'owania błędów), rate limit (20/min, 429 + `Retry-After`, osobne budżety gości, odblokowanie po minucie), walidacja (brak / 1 / 101 znaków → 400; 2 i 100 → 200), klucz limitu (cookie → IP → anonymous), podpięcie route'a do globalnego `fetch`.
- `npm run check`: lint + typecheck + 135 testów, wszystko przechodzi. `npm run e2e`: 10/10. `npm run build`: OK, `/api/search` jest dynamiczny.
- Ręczny smoke test na `npm run dev --port 3200` (prawdziwy Deezer): `?q=sanah` → 200 z utworami (np. „Szampan”, Sanah, okładka 250x250, 200 s), `?q=dawid` → 15 wyników; `?q=a`, brak `q`, 101 znaków → 400 z polskimi komunikatami; 20 zapytań z jednym `guestId` → 200, 21. → 429 z `Retry-After: 55`; inny `guestId` → 200. Serwer wyłączony po teście.

### Tester (próba 1)
**Wyniki**
- `npm run check`: lint OK, typecheck OK, Vitest 17 plików / 135 testów, wszystkie zielone.
- `npm run e2e`: 10/10 zielone (ticket nie ma UI, więc e2e służy tylko jako test regresji).
- `git diff`: zmieniony jest tylko ticket, reszta to nowe pliki. Żaden istniejący test nie został usunięty ani osłabiony.
- Smoke test na `npm run dev --port 3200` (prawdziwy Deezer):
  - `?q=sanah` → 200, „Szampan”/Sanah, okładka, 200 s.
  - `?q=a`, brak `q` i 101 znaków → 400 z polskimi komunikatami.
  - `?q=ac%2Fdc%26limit%3D999%23x` → 200. Zapytanie poszło do Deezera jako jeden zakodowany parametr `q` i nie nadpisało `limit`.
  - 21 zapytań z `Cookie: guestId=test-x`: 1–20 → 200, 21. → 429 `{"error":"RATE_LIMITED","message":"Za dużo wyszukiwań. Odczekaj chwilę i spróbuj ponownie."}` z `Retry-After: 56`.
  - Inny `guestId` → 200.
  - W logu serwera brak błędów. Serwer wyłączony po teście.

**Kryteria**
- ✅ `lib/catalog/` z interfejsem `TrackCatalog.search(query): Promise<Track[]>` (`lib/catalog/types.ts`) i implementacją `DeezerCatalog` (`lib/catalog/deezer.ts`). `CachedCatalog` to dekorator dowolnego katalogu, więc da się dodać inne źródła.
- ✅ `Track` ma pola id, title, artist, coverUrl (`string | null`), durationSec (`number | null`). Zgodne ze SPEC, gdzie `coverUrl?` i `durationSec?` są opcjonalne. Mapowanie testuje `catalog.test.ts` › „maps Deezer tracks to Track”.
- ✅ `GET /api/search`: walidacja zod (trim, 2–100 znaków) i najwyżej 15 wyników (`limit=15` w URL oraz `slice`). Testy: brak `q`, 1, „  a  ” i 101 znaków → 400; 2 i 100 znaków → 200; 20 wyników z Deezera → 15.
- ✅ Rate limit 20/min na guestId: `MemoryRateLimiter` za asynchronicznym interfejsem `RateLimiter`, 429 z polskim komunikatem i `Retry-After`. Testy w `search-api.test.ts` i `rate-limit.test.ts`, potwierdzone w smoke teście.
- ✅ Cache identycznych zapytań na 5 min: `CachedCatalog` + `MemoryCache` z wstrzykiwanym zegarem. Testy sprawdzają granicę 5 min − 1 ms / 5 min, normalizację klucza i to, że błędy nie są cache'owane.
- ✅ Błąd lub timeout Deezera → 502 z polskim komunikatem, bez szczegółów błędu. `AbortSignal.timeout(5000)` naprawdę przerywa żądanie: test z zawieszonym `fetch`, który reaguje na `abort`, kończy się `CatalogError` „Deezer request timed out”. Test 502 sprawdza, że w body nie ma „fetch failed”.
- ✅ Testy z zamockowanym `fetch` (bez sieci) obejmują mapowanie, rate limit, cache i błędy (HTTP 500/503, body `{error}`, zły JSON, błąd sieci, timeout). Test route'a podmienia globalny `fetch` przez `vi.stubGlobal`. Testy sprawdzają rzeczywiste wartości, nie przechodzą zawsze.

### Reviewer (próba 1)
**Krytyczne:** brak.

**Sprawdzone i w porządku**
- Walidacja wejścia zod-em z polskimi komunikatami, a niepoprawne zapytania nie zużywają limitu.
- Endpoint jest publiczny dla gości, więc brak sesji jest zgodny ze SPEC.
- URL do Deezera budowany jest przez `URLSearchParams` ze stałym hostem. Nie ma SSRF ani wstrzyknięcia parametrów, co potwierdził smoke test z `&limit=999#`.
- Odpowiedź 502 nie zawiera stack trace ani `cause`.
- Odpowiedź Deezera walidowana jest zod-em, łącznie z `{error}` przy HTTP 200.
- `cache: "no-store"` i odczyt `request.url` sprawiają, że route jest dynamiczny przy `cacheComponents`. Zgodne z `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` („Prerendering stops if the GET handler accesses … req.url”).
- Interfejsy `Cache<T>` i `RateLimiter` są asynchroniczne, a zegar wstrzykiwany, więc podmiana na Redis będzie prosta.
- Klucz limitu jest przycięty do 100 znaków, a cache ma limit 1000 wpisów.

**Drobne (na później)**
1. Mapa `MemoryRateLimiter.windows` nie ma górnego limitu. Czyści się tylko z okien starszych niż 1 min, a pełny przegląd mapy (O(n)) idzie przy każdym nowym kluczu. Gość, który zmienia ciasteczko `guestId` przy każdym żądaniu, jednocześnie omija limit i zwiększa mapę oraz koszt CPU (O(n²) w obrębie minuty). Do załatwienia w 007, gdzie `guestId` ma być podpisany lub wydawany przez serwer, albo dodatkowym limitem per IP. Warto też dodać `maxKeys` albo czyszczenie co jakiś czas.
2. Nagłówki `x-forwarded-for` / `x-real-ip` da się podrobić, jeśli przed aplikacją nie ma zaufanego proxy. Przy wdrożeniu trzeba to opisać albo brać IP z platformy.
3. `CatalogError` nie jest logowany (`console.error` tylko dla nieoczekiwanych błędów), więc awarie i timeouty Deezera nie zostawiają śladu w logach. Warto dodać `console.warn` z `error.message`.
4. Równoległe identyczne zapytania przy pustym cache wywołują Deezera kilka razy. Dla MVP to bez znaczenia; można scalać zapytania w locie (mapa promise'ów).
5. `MemoryCache` zwraca tę samą referencję tablicy. Jeśli kiedyś ktoś ją zmodyfikuje, zmieni się wpis w cache. Dziś nikt tego nie robi.
6. Po zapełnieniu cache każdy `set` przegląda całą mapę (n ≤ 1000), co jest akceptowalne.

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Uwaga 1 reviewera (limit rozmiaru mapy rate limitera, guestId wydawany przez serwer) przekazana do ticketu 007. Ticket zamknięty.
