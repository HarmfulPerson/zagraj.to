---
id: "005"
title: Kod QR i plakat do druku
status: done
depends_on: ["004"]
attempts: 1
---

## Cel
DJ ma QR prowadzący gości na stronę wydarzenia i może wydrukować plakat.

## Kryteria akceptacji
- [x] Helper buduje URL gościa `${NEXT_PUBLIC_APP_URL}/e/<code>` (zmienna w `.env.example`)
- [x] Na stronie wydarzenia w panelu widoczny QR (biblioteka `qrcode`, SVG), kod tekstowy i przycisk „Kopiuj link”
- [x] `/panel/wydarzenia/[id]/plakat`: układ A4 (CSS `@media print`), nazwa wydarzenia, duży QR, kod tekstowy i hasło „Zeskanuj i zamów piosenkę”
- [x] Przycisk „Drukuj” wywołuje `window.print()`, a elementy nawigacji są ukryte na wydruku
- [x] Test jednostkowy budowania URL; e2e: plakat renderuje się z poprawnym kodem

## Log

### Developer (próba 1)
**Co zrobiono**
- Dodano bibliotekę `qrcode` (+ `@types/qrcode`). QR renderowany po stronie serwera jako skalowalne SVG (`lib/qr.ts`, komponent `QrCode`).
- `lib/guest-url.ts`: `getAppUrl()` (czyta `NEXT_PUBLIC_APP_URL`, obcina końcowe `/`, fallback `http://localhost:3000`, gdy zmienna pusta/brak), `buildGuestEventUrl(code)` → `${NEXT_PUBLIC_APP_URL}/e/<code>`, `displayGuestEventUrl()` (adres bez protokołu na plakat). Ścieżki `guestEventPath`, `eventPosterPath` w `lib/app.ts`. Zmienna dopisana do `.env.example` (i do lokalnego `.env.local`).
- Strona wydarzenia w panelu: nowa karta „Kod QR dla gości” z QR, linkiem dla gości, przyciskiem „Kopiuj link” (clipboard, stan „Skopiowano!” / „Nie udało się skopiować”) i linkiem „Plakat do druku”. Kod tekstowy był już w karcie szczegółów.
- `/panel/wydarzenia/[id]/plakat`: arkusz A4 (nazwa ZagrajTo, nazwa wydarzenia z rozmiarem czcionki zależnym od długości — `lib/poster.ts`, hasło „Zeskanuj i zamów piosenkę”, duży QR ~11 cm, kod wydarzenia, adres „albo wejdź na …”, 3 kroki). Wymiary wewnątrz w `cqw`, więc podgląd na ekranie to dokładnie przeskalowana kartka. Druk: nazwana strona `@page poster { size: A4; margin: 0 }`, arkusz 210×297 mm, `print-color-adjust: exact`. Przycisk „Drukuj” → `window.print()`. Na wydruku ukryte: nagłówek panelu (`print:hidden` w `app/panel/layout.tsx`), link powrotu, tytuł i przycisk. Cudze/nieistniejące wydarzenie → istniejący `not-found` („Nie znaleziono wydarzenia”).
- Własny tekst na plakacie (Pro) celowo pominięty — ticket 011.

**Zmienione/nowe pliki**
`package.json`, `package-lock.json`, `.env.example`, `lib/app.ts`, `lib/guest-url.ts` (nowy), `lib/qr.ts` (nowy), `lib/poster.ts` (nowy), `components/panel/QrCode.tsx` (nowy), `components/panel/CopyLinkButton.tsx` (nowy), `components/panel/PrintButton.tsx` (nowy), `app/panel/wydarzenia/[id]/page.tsx`, `app/panel/wydarzenia/[id]/plakat/page.tsx` (nowy), `app/panel/layout.tsx`, `app/globals.css`, `tests/unit/guest-url.test.ts` (nowy), `tests/unit/qr.test.ts` (nowy), `tests/e2e/poster.spec.ts` (nowy).

**Testy**
- Unit: budowanie URL (env, fallback bez env, końcowe `/`, jawny base URL, enkodowanie), ścieżki, adres bez protokołu, SVG z QR (viewBox, bez stałych wymiarów), skalowanie czcionki tytułu.
- E2E (`tests/e2e/poster.spec.ts`, własne dane, unikalne e-maile): QR + link `/e/<code>` na stronie wydarzenia, „Kopiuj link” kopiuje dokładny URL do schowka, plakat ma poprawną nazwę/kod/hasło/QR (`data-qr-value` = URL gościa), „Drukuj” wywołuje `window.print()` dokładnie raz, w `media: print` nagłówek/link/przycisk ukryte; PDF A4 z długą nazwą ma dokładnie 1 stronę; inny DJ dostaje „Nie znaleziono wydarzenia”.
- `npm run check` OK (108 testów), `npm run e2e` OK (10/10).

**Kontrola wizualna** (dev server :3200, `scripts/ui-shots.mjs` dla strony wydarzenia i plakatu we wszystkich viewportach + skrypt Playwright z `emulateMedia({ media: 'print' })` 794×1123 i `page.pdf({ format: 'A4' })` dla krótkiej i 100-znakowej nazwy): PDF ma 1 stronę A4 (MediaBox 595×842), nawigacja niewidoczna na wydruku, QR duży i z białym marginesem, tekst po polsku, długa nazwa mieści się w 3 liniach. W trakcie poprawiono: `cqw` w paddingu arkusza liczyło się względem viewportu (przeniesiono padding do wewnętrznego wrappera) i przeskalowano elementy, żeby zmieściły się na A4. Na telefonie 360 px podgląd plakatu jest pomniejszoną kartką (bardzo długa nazwa może się tam uciąć wielokropkiem przez zaokrąglenia czcionek; wydruk jest poprawny).

### Tester (próba 1)
**Wyniki**
- `npm run check`: OK (lint, typecheck, 13 plików / 108 testów vitest).
- `npm run e2e`: OK (10/10, w tym 3 nowe w `tests/e2e/poster.spec.ts`).
- Kontrola wizualna (dev :3200): `scripts/ui-shots.mjs` dla strony wydarzenia i plakatu we wszystkich viewportach + Playwright `emulateMedia({ media: 'print' })` 794×1123 i `page.pdf({ format: 'A4' })`. Wydruk: dokładnie 1 strona A4 (scrollHeight 1123 px, PDF `/Count 1`), QR duży (~połowa szerokości kartki) z białym marginesem, nagłówek panelu / link powrotu / „Drukuj” niewidoczne, teksty po polsku. 100-znakowa nazwa mieści się w 3 liniach. QR zdekodowany ze zrzutu (jsQR) = `http://localhost:3000/e/BRKM7M`, czyli dokładnie URL gościa z kodem wydarzenia (base z `NEXT_PUBLIC_APP_URL`).

**Kryteria**
- ✅ Helper URL: `lib/guest-url.ts` `buildGuestEventUrl()` → `${getAppUrl()}/e/<code>`, fallback `http://localhost:3000`, obcinanie `/`; zmienna w `.env.example`. Testy w `tests/unit/guest-url.test.ts` (env, brak env, `/`, enkodowanie).
- ✅ Strona wydarzenia: karta „Kod QR dla gości” z SVG z biblioteki `qrcode` (`lib/qr.ts`, `QrCode`), kod tekstowy (karta szczegółów, `event-code`), „Kopiuj link” (`CopyLinkButton`). E2E sprawdza SVG, `data-qr-value`, link i zawartość schowka po kliknięciu.
- ✅ `/panel/wydarzenia/[id]/plakat`: arkusz A4 (`@page poster { size: A4 }`, `@media print` w `app/globals.css`), nazwa, duży QR, kod, hasło „Zeskanuj i zamów piosenkę”. E2E sprawdza nazwę, kod, hasło, QR = URL gościa oraz 1 stronę PDF A4.
- ✅ „Drukuj” → `window.print()` (`PrintButton`), e2e liczy dokładnie 1 wywołanie; w `media: print` nagłówek (`print:hidden` w `app/panel/layout.tsx`), link powrotu i przycisk ukryte (e2e).
- ✅ Testy: unit budowania URL + e2e plakatu z poprawnym kodem; dodatkowo e2e: cudzy plakat → „Nie znaleziono wydarzenia”.

Żaden istniejący test nie został usunięty ani osłabiony (`git diff` – tylko nowe pliki testów).

### Reviewer (próba 1)
**Krytyczne:** brak.

Sprawdzone:
- Własność zasobu: strona wydarzenia i plakat używają `requireDj()` + `eventIdSchema.safeParse` + `findDjEvent(dj.id, id)`; cudze/nieistniejące → `notFound()` (pokryte e2e dla obu stron). Brak nowych API routes.
- XSS: SVG wstrzykiwane przez `dangerouslySetInnerHTML`, ale treść generuje wyłącznie biblioteka `qrcode` z URL zbudowanego z env + serwerowego kodu (dodatkowo `encodeURIComponent`); nazwa wydarzenia trafia tylko do JSX/`aria-label` (escapowane przez React). Ręcznie sprawdzone wydarzenie o nazwie `<img src=x onerror=alert(1)><script>…` – renderuje się jako tekst, brak dialogu.
- Env: `NEXT_PUBLIC_APP_URL` w `.env.example`, fallback na localhost przy braku/pustej wartości, brak sekretów.
- UI po polsku, zakres zgodny (własny tekst Pro odłożony do 011), Next 16 API (`PageProps`, `params` jako Promise w `Suspense`) użyte poprawnie.

**Drobne (na później):**
- `NEXT_PUBLIC_APP_URL` musi być ustawiony na produkcji – przy braku QR wskaże `localhost:3000` bez ostrzeżenia; warto rozważyć ostrzeżenie/wymóg w produkcji (podobnie jak dla `SESSION_SECRET`). Lokalnie przy innym porcie (np. 3200) QR też wskazuje :3000.
- `getAppUrl()` nie waliduje formatu URL (np. przez `z.url()`); zmienna jest zaufana, więc to tylko higiena.
- E2E weryfikuje QR przez atrybut `data-qr-value`, a nie dekodując obraz; unit test potwierdza tylko, że różne URL dają różne SVG. Dekodowanie ręczne w review przeszło, ale można dodać test dekodujący (np. jsQR) w przyszłości.

### Orkiestrator
Tester: PASS, reviewer: APPROVE (QR zdekodowany ze zrzutu: poprawny URL gościa). Uwaga na produkcję: ustawić NEXT_PUBLIC_APP_URL. Ticket zamknięty.
