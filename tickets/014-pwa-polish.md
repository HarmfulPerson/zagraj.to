---
id: "014"
title: PWA i dopracowanie mobile
status: done
depends_on: ["009", "013"]
attempts: 1
---

## Cel
Aplikacja dobrze działa na telefonie gościa i tablecie DJ-a.

## Kryteria akceptacji
- [x] `manifest.webmanifest` z nazwą, kolorami i ikonami (proste wygenerowane SVG/PNG); DJ może dodać panel do ekranu głównego
- [x] Stany ładowania i błędów na stronie gościa i tablicy DJ-a (np. utrata połączenia: „Brak połączenia, próbuję ponownie”)
- [x] Wszystkie teksty UI po polsku; brak angielskich resztek (test e2e przeszukujący kluczowe strony pod kątem typowych angielskich słów UI)
- [x] Podstawowa dostępność: etykiety przycisków, kontrast, obsługa klawiatury w formularzach
- [x] Ciemny motyw domyślny dla strony gościa (impreza, ciemna sala)

## Log

### Developer (próba 1)
**Co zrobiono**
- **PWA**: `app/manifest.ts` (`/manifest.webmanifest`): nazwa i short_name „ZagrajTo”, opis z `APP_TAGLINE`, `lang: pl`, `start_url` i `id` = `/panel`, `display: standalone`, `theme_color`/`background_color` = `#09090b` (`DARK_THEME_COLOR` w `lib/app.ts`), ikony 192/512 (any) i 192/512 (maskable) oraz SVG. Ikony marki (gradient fiolet→fuksja z nutą, jak logo) wygenerowane skryptem Playwright ze scratchpada (niecommitowany): `public/icons/{icon,maskable}-{192,512}.png`, `app/icon.svg`, `app/apple-icon.png` (180), nowy `app/favicon.ico` (16/32/48, zamiast domyślnego z Next). W root layoucie `appleWebApp` (iOS: pełny ekran, nazwa pod ikoną). **Bez service workera, celowo**: każdy ekran pokazuje dane na żywo (polling co 3 s), więc cache offline pokazywałby tylko nieaktualną listę. Zamiast tego strony mówią wprost „Brak połączenia” (opis w komentarzu w `manifest.ts`).
- **theme-color / color-scheme**: root `viewport` (jasny `#fafafa` / ciemny `#09090b` zależnie od systemu, dla logowania i rejestracji), `(site)` i `/e` zawsze ciemne (`themeColor` + `colorScheme: dark`), panel w kolorze nagłówka (biały albo `#18181b`), tablica DJ-a zawsze ciemna. Strona gościa była już ciemna. Test e2e sprawdza ciemne tło, `color-scheme: dark` i `theme-color` także przy jasnym motywie systemu.
- **Brak połączenia**: nowy `components/ConnectionBanner.tsx` (`useOnline()` przez `useSyncExternalStore` + baner „Brak połączenia, próbuję ponownie…”, live region `role=status`). Baner pokazuje się, gdy przeglądarka jest offline (SWR wtedy nie odpytuje, więc sam błąd SWR by nie wystarczył) **albo** gdy ostatnie odświeżenie się nie udało. Znika sam: SWR odświeża dane po powrocie sieci (`revalidateOnReconnect`). U gościa baner jest na dole ekranu nad komunikatami. Wersja „na górze” zasłaniała logo i znaczek na 360 px. Lista zostaje widoczna, a „Na żywo” jest ukryte, dopóki nie ma połączenia. Na tablicy baner jest chipem w przyklejonym nagłówku (zastąpił „Brak połączenia, ponawiam…”). Usunięty stary komunikat „Nie udało się odświeżyć listy…” z `GuestRequestList`.
- **Ładowanie**: tablica, lista wydarzeń, plakat i subskrypcja miały już skeletony w `<Suspense>`. Strona gościa jest renderowana na serwerze razem z listą i świadomie nie ma `loading.tsx`, bo streaming zamieniłby prawdziwe 404 dla złego kodu na 200 (test w `guest.spec.ts`). Wyniki wyszukiwania mają skeleton od wcześniej.
- **Granice błędów (PL)**: `app/(site)/error.tsx` (nagłówek i stopka zostają), `app/panel/error.tsx` (nagłówek panelu i wylogowanie zostają), `app/e/error.tsx` (ciemny `GuestMessage` z nową `WarningIcon`), dodatkowo `app/error.tsx` (logowanie, rejestracja) i `app/global-error.tsx`. Wszystkie mają „Spróbuj ponownie” (`retry()` z Next 16.4) i link powrotu. Wspólny `components/errors/useLogError.ts`. Nowy `app/not-found.tsx` po polsku („Nie ma takiej strony”, ciemny jak strona publiczna). Wcześniej nieznany adres pokazywał angielską stronę 404 z Next. 404 dla gościa i w panelu zostały jak były i są spójne.
- **Dostępność**: axe-core (`@axe-core/playwright` 4.13.0, devDependency) nie zgłasza błędów serious/critical na żadnej kluczowej stronie. Naprawione przy tym problemy z kontrastem (AA): na tablicy przycisk „Akceptuj” (emerald-600 → 700), czas dodania, puste kolumny, „Pokaż/Ukryj”, „Nic nie odrzucono”; u gościa wykonawca w „Zagrane”, liczba utworów, głosy, czas trwania i placeholder wyszukiwarki (zinc-500 → zinc-400 na ciemnym tle). Fokus: globalny `:focus-visible` (outline 2 px w kolorze motywu: fiolet, lime na stronie publicznej, jasny fiolet na ciemnych ekranach) dla linków, przycisków i `summary` bez własnego stylu. Pola formularzy mają wyraźniejszy ring w ciemnym motywie. Przycisk wysyłania formularza ma jasny outline w ciemnym motywie. Licznik „N nowe” ma własny live region, strzałka jest `aria-hidden`. Poprawiona odmiana: „2 nowe” (było „2 nowych”).
- **Z review 013**: (a) `app/(site)/opengraph-image.tsx` (ImageResponse 1200×630, hasło z `HERO_TITLE` przeniesionego do `lib/site.ts`, makieta listy życzeń, font Geist dołączony do Next, polskie znaki OK, `alt`), twitter card `summary_large_image`. (b) Nagłówek: w trakcie streamingu sesji zamiast linków dla gościa jest neutralny placeholder, więc zalogowany nie widzi przez chwilę „Zaloguj”. Stopka bez linków logowania: „Cennik” i „Panel DJ-a”, które działają dla każdego. (c) Notka na rejestracji kończy się „(płatność w następnym kroku)”. (d) Mikrotekst: „Plan Free za 0 zł: 1 wydarzenie w miesiącu. Bez karty płatniczej.” (liczby z `lib/plans.ts`).
- Angielskich resztek w UI nie znalazłem: nowy test przeszedł od razu na wszystkich stronach. Jedyne angielskie miejsce to natywny placeholder pola daty („mm/dd/yyyy”) w Chromium uruchomionym przez Playwright. Zależy od języka przeglądarki, nie od aplikacji: polski Chrome pokazuje „dd.mm.rrrr”.

**Zmienione/nowe pliki**: `app/manifest.ts`, `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`, `public/icons/*.png`, `app/layout.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/(site)/{layout,page,error,opengraph-image}.tsx`, `app/e/{layout,error}.tsx`, `app/panel/{layout,error}.tsx`, `app/panel/wydarzenia/[id]/page.tsx`, `app/rejestracja/page.tsx`, `app/globals.css`, `components/ConnectionBanner.tsx`, `components/errors/useLogError.ts`, `components/auth/FormField.tsx`, `components/guest/{GuestEventLive,GuestMessage,GuestRequestList,TrackParts}.tsx`, `components/panel/board/{DjBoard,BoardCard}.tsx`, `components/site/{SiteHeader,SiteFooter}.tsx`, `lib/app.ts`, `lib/site.ts`, `package.json`, `package-lock.json`, testy: `tests/e2e/{polish-a11y,offline}.spec.ts` (nowe), `tests/e2e/db-helpers.ts` (`seedRequests` z opcjonalnym `from`), `tests/e2e/dj-board.spec.ts`, `tests/unit/{connection-banner.test.tsx,manifest.test.ts}` (nowe), `tests/unit/site.test.ts`.

**Testy**
- `polish-a11y.spec.ts` odwiedza `/`, `/cennik` (gość i zalogowany), `/logowanie`, `/rejestracja` (też `?plan=pro`), 404, 404 gościa, `/panel`, `/panel/wydarzenia/nowe`, tablicę (także z rozwiniętym „Wydarzenie i QR”), plakat, `/panel/subskrypcja`, 404 w panelu i `/e/<kod>` (lista i wyniki wyszukiwania, telefon). Panel sprawdzany w jasnym i ciemnym motywie systemu. Na każdej stronie: `lang="pl"`, brak angielskich słów UI jako całych słów (widoczny tekst, `<title>`, `aria-label`, `title`, `placeholder`, `alt`; lista ~40 słów, allowlista marek Spotify/rekordbox/Pro/Free/QR/BLIK/Stripe…) i axe bez naruszeń serious/critical (WCAG 2.1 A/AA). Do tego test samego detektora oraz test klawiatury: rejestracja wypełniona i wysłana samym Tab/Enter, a przycisk w fokusie ma widoczny outline.
- `offline.spec.ts`: `context.setOffline(true)` → baner u gościa (360 px) i na tablicy, lista zostaje; po `setOffline(false)` baner znika, a lista dociąga utwory dodane w czasie offline. Drugi przypadek: endpoint listy zwraca 503 (przeglądarka online) → baner, po naprawie znika. `--repeat-each=3` zielone.
- `dj-board.spec.ts`: asercja „2 nowych” → „2 nowe”. To poprawka gramatyki, test nie jest słabszy.
- Unit: baner (tekst, pusty live region, ukryty spinner), manifest (start_url, standalone, kolory, ikony 192/512 any+maskable istnieją i mają te rozmiary, apple-icon 180, SVG), `publicPageMetadata` → `summary_large_image`.
- `npm run check` ✅ (392 testy), pełne `npm run e2e` ✅ dwa razy z rzędu (43/43, 43/43), `npm run build` ✅ (manifest, ikony statyczne; `/` i `/cennik` nadal Partial Prerender).

**Kontrola wizualna** (dev na 3200): baner offline u gościa (360) i na tablicy (tablet, telefon poziomo). Pierwsza wersja u gościa zasłaniała logo, więc przeniosłem baner na dół. Granice błędów (site, panel, gość, root) obejrzane przez tymczasowe strony rzucające wyjątek, potem usunięte. Strony 404 (root, gość, panel). Ikony PNG (any, maskable, apple). Obrazek OG `/opengraph-image-…`: dopisałem „Bez aplikacji dla gości”. Fokus: Tab przez rejestrację (jasny i ciemny motyw; ring pola w ciemnym motywie był prawie niewidoczny, poprawiony), landing i cennik (lime), gość (przycisk serca). Końcowy `scripts/ui-shots.mjs` na 4 viewportach dla `/`, `/cennik`, `/logowanie`, `/rejestracja(?plan=pro)`, `/e/<kod>`, 404 oraz (z cookie DJ-a) `/panel`, tablicy, plakatu, subskrypcji, nowego wydarzenia, `/cennik`, `/`. Bez poziomego overflow, jedyne HTTP 404 to strony 404 (oczekiwane). Dane z kontroli wizualnej usunięte z dev.db, serwer zatrzymany.

### Tester (próba 1)
**Wyniki**
- `npm run check` ✅ (lint, typecheck, 392 testy unit w 37 plikach).
- Pełne `npm run e2e` ✅ dwa razy z rzędu: 43/43, 43/43.
- `npm run build` ✅: `/manifest.webmanifest`, `/icon.svg` i `/apple-icon.png` są statyczne (○), `/opengraph-image-12o0cb` dynamiczny (ƒ), `/` i `/cennik` nadal Partial Prerender.
- `git diff tests/`: w `dj-board.spec.ts` zmieniono „2 nowych” na „2 nowe”. To poprawna odmiana (2–4 → „nowe”, `polishPlural`), a asercja nie jest słabsza. W `db-helpers.ts` `seedRequests` dostał opcjonalny `from` (domyślnie 0, zachowanie bez zmian). `site.test.ts` ma tylko dopisany test. Pozostałe testy są nowe. Nic nie usunięto ani nie osłabiono.

**Kryteria**
- ✅ Manifest: dev `/manifest.webmanifest` → 200 `application/manifest+json`. Ma `name`/`short_name` „ZagrajTo”, `lang: pl`, `start_url` `/panel`, `standalone`, kolory `#09090b`. Wszystkie 5 ikon zwraca 200 z właściwym typem (PNG 192/512 any + maskable, SVG). `<link rel="manifest">` i `apple-touch-icon` są w `<head>`. Ikony obejrzane: gradient z nutą, maskable pełne tło z glifem w strefie bezpiecznej. Unit `manifest.test.ts` sprawdza wymiary PNG z nagłówka IHDR.
- ✅ Ładowanie i błędy: `offline.spec.ts` (`setOffline` u gościa 360 px i na tablicy oraz 503 z endpointu listy) sprawdza baner „Brak połączenia, próbuję ponownie…” (`role=status`), to że lista zostaje i że baner znika po powrocie, a lista dociąga nowe pozycje. Polskie granice błędów są w `app/error.tsx`, `global-error.tsx`, `(site)/error.tsx`, `e/error.tsx` i `panel/error.tsx`, do tego polski `not-found.tsx`. Skeletony istniały wcześniej. Granice błędów nie mają testu automatycznego, developer obejrzał je ręcznie (uwaga drobna).
- ✅ Teksty po polsku: `polish-a11y.spec.ts` przeszukuje widoczny tekst, `<title>`, `aria-label`, `title`, `placeholder` i `alt` na ~20 widokach (publiczne, panel jasny i ciemny, tablica z rozwiniętym zarządzaniem, plakat, subskrypcja, 404, gość z wynikami wyszukiwania). Lista ~40 typowych słów UI dopasowywana jest jako całe słowa, bez względu na wielkość liter. Allowlista to wyłącznie marki i nazwy planów (Spotify, Pro, Free, QR, BLIK, Stripe…) i nie pokrywa się z listą słów. Test detektora sprawdza, że „Loading”/„Sign in” są łapane, a polskie słowa nie. Skan może więc realnie zawieść, a do tego sprawdzany jest `lang="pl"`.
- ✅ Dostępność: axe (WCAG 2.1 A/AA) bez serious/critical na tych samych widokach. Test klawiatury: rejestracja samym Tab/Enter i widoczny outline na przycisku. Poprawki kontrastu są widoczne w diffie.
- ✅ Ciemny motyw gościa: e2e przy jasnym motywie systemu sprawdza `theme-color #09090b`, `color-scheme: dark` i tło `rgb(9,9,11)`. Zrzut gościa z `colorScheme: light` jest ciemny.
- ✅ Przekazane z 013: `og:image` i `twitter:image` wskazują `/opengraph-image-…` (200 `image/png` 1200×630, polskie znaki OK). Nagłówek ma neutralny placeholder zamiast „Zaloguj” w trakcie streamingu. Notka rejestracji kończy się „(płatność w następnym kroku)”. Mikrotekst „Plan Free za 0 zł: 1 wydarzenie w miesiącu. Bez karty płatniczej.” bierze dane z `PLAN_LIMITS`/`formatEventAllowance` (`lib/plans.ts`).

**Wizualnie** (dev 3200, Playwright)
- Gość 360 px offline: bursztynowy baner na dole nie zasłania listy ani nagłówka, „Na żywo” jest ukryte. Po `setOffline(false)` baner znika.
- Tablica (tablet) offline: chip w nagłówku obok przełącznika zgłoszeń, układ się nie rozjeżdża. Po powrocie chip znika.
- 404: ciemna, po polsku, HTTP 404.
- Obrazek OG czytelny, ale napis w lime pigułce łamie się na dwie linie („Życzenia muzyczne z kodu / QR”). To kosmetyka.
- `node scripts/ui-shots.mjs / /cennik /logowanie /rejestracja` na 4 viewportach: bez zgłoszonych problemów (overflow, konsola, HTTP). Stopka ma „Cennik” i „Panel DJ-a”.
- Uwaga środowiskowa: serwer dev uruchomiony zaraz po `npm run build` wpadł w pętlę przeładowań HMR („HMR hash mismatch”). Po restarcie serwera wszystko było stabilne, więc to nie jest problem aplikacji.
- Dane testowe (`visual-014-*`) usunięte z dev.db, serwer zatrzymany.

### Reviewer (próba 1)
**Krytyczne**: brak.

**Bezpieczeństwo**
- Granice błędów nie pokazują użytkownikowi `error.message` ani stosu. Pokazują tylko polski komunikat i „Spróbuj ponownie” (`retry` z Next 16.4, zgodnie z `node_modules/next/dist/docs/.../error.md`). Błąd trafia wyłącznie do `console.error` (w produkcji Next podaje klientowi tylko digest).
- Nie dodano nowych API routes ani zmian w autoryzacji. `@axe-core/playwright` 4.13.0 jest w `devDependencies` i ma `"dev": true` w lockfile. Skrypt generujący ikony nie jest commitowany.

**Jakość / zgodność**
- Logika banera jest poprawna: `!navigator.onLine || błąd SWR`. Jest potrzebna, bo SWR offline nie odpytuje, więc samo `error` by nie wystarczyło. `useSyncExternalStore` z SSR = online nie daje niezgodności hydratacji. Live region jest stale zamontowany. Na tablicy poza stanem LIVE (brak pollingu) baner pokazuje tylko offline, co ma sens.
- Usunięcie starego komunikatu „Nie udało się odświeżyć listy…” nie zostawiło luki, bo zastąpił go wspólny baner.
- Ikony mają rozsądny rozmiar (9–123 KB, favicon 3 KB). Teksty są po polsku. Zakres zgodny z ticketem i z uwagami z 013. Stopka bez linków logowania to świadoma realizacja uwagi (b).

**Drobne** (na później)
- `app/(site)/opengraph-image.tsx`: komentarz mówi „Generated at build time”, a build pokazuje trasę jako dynamiczną (ƒ). Font czytany jest w runtime z `process.cwd()/node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf`. Przy wdrożeniu `output: standalone`/serverless ta ścieżka może nie istnieć. Lepiej skopiować font do repo (np. `app/(site)/_fonts/`) i czytać go względem pliku, albo wymusić statyczne generowanie. Do tego napis w pigułce łamie się na dwie linie (`whiteSpace: nowrap` albo krótszy tekst).
- `public/icons/icon-512.png` (123 KB) można odchudzić (np. kwantyzacja palety).
- Brak testu automatycznego granic błędów i placeholdera nagłówka. Wystarczy prosty unit renderujący `SiteError`/`GuestError` z błędem zawierającym sekret, żeby sprawdzić, że go nie wyświetla.

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Uwaga na wdrożenie: opengraph-image czyta font z node_modules (może wymagać kopii fontu w repo przy deployu standalone). Ticket zamknięty.
