---
id: "003"
title: Rejestracja i logowanie DJ-a
status: done
depends_on: ["002"]
attempts: 1
---

## Cel
DJ może założyć konto, zalogować się i wylogować. Strony `/panel/*` są chronione.

## Kryteria akceptacji
- [x] `/rejestracja`: email, nazwa wyświetlana, hasło (min. 8 znaków); duplikat emaila daje czytelny błąd po polsku
- [x] `/logowanie`: błędne dane dają ogólny komunikat (bez zdradzania, czy email istnieje)
- [x] Hasła hashowane bcryptem; sesja w ciasteczku httpOnly, secure w produkcji (iron-session, `SESSION_SECRET` w `.env.example`)
- [x] Wylogowanie czyści sesję
- [x] Middleware lub helper `requireDj()` przekierowuje niezalogowanych z `/panel/*` na `/logowanie`
- [x] Testy jednostkowe walidacji i hashowania; e2e: rejestracja → panel → wylogowanie → logowanie

## Log

### Developer (próba 1)
**Co zrobiono**
- Rejestracja `/rejestracja` (e-mail, nazwa wyświetlana, hasło min. 8 znaków, max 72 bajty ze względu na bcrypt) i logowanie `/logowanie` jako formularze z Server Actions (`useActionState`), walidacja zod z komunikatami po polsku, e-mail normalizowany (trim + małe litery). Duplikat e-maila: „Konto z tym adresem e-mail już istnieje. Zaloguj się albo użyj innego adresu.” (sprawdzenie + obsługa wyścigu P2002).
- Logowanie: jeden ogólny komunikat „Nieprawidłowy e-mail lub hasło.” dla nieznanego e-maila i złego hasła; przy nieznanym e-mailu wykonywane jest porównanie z atrapą hasha (podobny czas odpowiedzi).
- Hasła: bcryptjs, 12 rund (`lib/password.ts`).
- Sesja: iron-session, ciasteczko `zagrajto_session` httpOnly, `sameSite=lax`, `secure` w produkcji, TTL 14 dni; w sesji tylko `djId`. `SESSION_SECRET` dopisany do `.env.example`; w produkcji brak sekretu (lub < 32 znaki) rzuca błąd, w dev/testach używany jest fallback tylko-deweloperski (testy i e2e działają bez plików env). Lokalny sekret dopisany do `.env.local`.
- Wylogowanie: przycisk „Wyloguj się” w nagłówku panelu, `session.destroy()` + przekierowanie na `/logowanie`.
- Ochrona `/panel/*`: `proxy.ts` (Next 16, dawniej middleware) odszyfrowuje ciasteczko i przekierowuje bez ważnej sesji na `/logowanie`; dodatkowo `requireDj()` w `lib/auth.ts` (sprawdza też, czy użytkownik istnieje w bazie) używany w layoucie i stronie panelu. Odczyt sesji jest za `<Suspense>` i po `connection()` (wymóg Cache Components; bez tego Next zgłaszał `Date.now()` podczas prerenderu).
- Minimalna strona `/panel` (powitanie + pusty stan); lista wydarzeń to ticket 004.

**Zmienione/nowe pliki**
- nowe: `lib/session-config.ts`, `lib/password.ts`, `lib/auth-validation.ts`, `lib/dj-accounts.ts`, `lib/auth.ts`, `proxy.ts`, `app/auth-actions.ts`, `app/rejestracja/page.tsx`, `app/logowanie/page.tsx`, `app/panel/layout.tsx`, `app/panel/page.tsx`, `components/auth/AuthCard.tsx`, `components/auth/FormField.tsx`, `components/auth/RegisterForm.tsx`, `components/auth/LoginForm.tsx`
- testy: `tests/unit/auth-validation.test.ts`, `tests/unit/password.test.ts`, `tests/unit/session-config.test.ts`, `tests/integration/dj-accounts.test.ts`, `tests/e2e/auth.spec.ts`
- zmienione: `package.json`/`package-lock.json` (dodane `iron-session`, `zod` jako jawne zależności), `.env.example` (`SESSION_SECRET`)

**Jak przetestowano**
- `npm run check`: lint, typecheck, 40 testów (unit: walidacja, hashowanie, konfiguracja sesji; integracja na test.db: rejestracja, duplikat e-maila bez względu na wielkość liter, logowanie poprawne/błędne).
- `npm run e2e`: 5/5, m.in. rejestracja → panel → wylogowanie → (panel znów chroniony) → logowanie, sprawdzenie httpOnly ciasteczka, przekierowanie niezalogowanego z `/panel` i `/panel/wydarzenia/nowe`, duplikat e-maila, ogólny komunikat przy złych danych. Unikalne e-maile w każdym uruchomieniu.
- `next build` przechodzi (`/panel` jako Partial Prerender, `/logowanie` i `/rejestracja` statyczne, Proxy aktywne).
- Kontrola wizualna (`scripts/ui-shots.mjs`, port 3200): `/rejestracja`, `/logowanie`, `/panel` (z ciasteczkiem sesji) we wszystkich 4 viewportach oraz stany błędów przy 360px (walidacja rejestracji, zły login). Brak poziomego przewijania i błędów konsoli, pola i przyciski min. 48 px wysokości, teksty po polsku. Poprawka po oglądzie: czerwona ramka pól z błędem pojawiała się z opóźnieniem przez `transition` na kolorze ramki; ograniczone do `transition-shadow`.

### Tester (próba 1)
**Wyniki**
- `npm run check`: ✅ lint, typecheck, Vitest 7 plików / 40 testów zielonych.
- `npm run e2e`: ✅ 5/5 (rejestracja → panel → wylogowanie → logowanie, przekierowanie niezalogowanego, duplikat e-maila, ogólny komunikat logowania, strona główna).
- `curl -sI http://localhost:3200/panel` bez ciasteczka → `307 location: /logowanie`; z podrobionym ciasteczkiem na `/panel/x` → 307 na `/logowanie` + usunięcie ciasteczka.
- Ciasteczko po rejestracji (dev): `httpOnly=true`, `sameSite=Lax`, `secure=false` (w dev oczekiwane), wygasa po ~14 dniach.
- `git diff`: żaden istniejący test nie został usunięty ani osłabiony; wszystkie nowe pliki testów są nieśledzone i nowe.

**Kryteria**
- ✅ `/rejestracja`: e-mail, nazwa wyświetlana, hasło min. 8 znaków (`lib/auth-validation.ts`, test jednostkowy granicy 7/8 znaków); duplikat e-maila (także inną wielkością liter) daje „Konto z tym adresem e-mail już istnieje…” — test integracyjny `dj-accounts.test.ts` i e2e `duplicate email shows a Polish error`.
- ✅ `/logowanie`: jeden komunikat „Nieprawidłowy e-mail lub hasło.” dla nieznanego e-maila i złego hasła (`authenticateDj` + atrapa hasha); test integracyjny i e2e.
- ✅ bcrypt (bcryptjs, 12 rund, `lib/password.ts`, testy formatu hasha, soli i weryfikacji); iron-session, httpOnly, `secure` w produkcji (`lib/session-config.ts`, test `buildSessionOptions`), `SESSION_SECRET` w `.env.example`.
- ✅ Wylogowanie: `session.destroy()` + redirect; e2e sprawdza brak ciasteczka i ponowną ochronę `/panel`.
- ✅ `proxy.ts` (Next 16) z matcherem `/panel`, `/panel/:path*` + `requireDj()` w layoucie i stronie; e2e dla `/panel` i `/panel/wydarzenia/nowe`, potwierdzone curl-em.
- ✅ Testy jednostkowe walidacji i hashowania + e2e pełnego przepływu.

**Kontrola wizualna** (dev :3200, `scripts/ui-shots.mjs /rejestracja /logowanie /panel`, 4 viewporty, plus stany błędów przy 360 px): skrypt nie zgłosił poziomego przewijania, błędów konsoli ani HTTP ≥ 400. Przy 360 px karta formularza mieści się z marginesami, pola i przycisk ≥ 48 px, etykiety i podpowiedzi czytelne, błędy walidacji pod polami na czerwono z czerwoną ramką, alert logowania wyraźny. Panel: długa nazwa DJ-a ładnie się zawija w nagłówku H1, przycisk „Wyloguj się” mieści się obok logo. Teksty po polsku, poprawne znaki diakrytyczne. Brak problemów.

TEST: PASS

### Reviewer (próba 1)
**Krytyczne:** brak.

Sprawdzone pod kątem bezpieczeństwa:
- Hasła: bcrypt 12 rund, limit 72 bajtów (brak cichego obcinania), hash nigdy nie wraca z `authenticateDj`.
- Ciasteczko: iron-session (szyfrowane + podpisane), `httpOnly`, `sameSite=lax`, `secure` przy `NODE_ENV=production`, `path=/`, TTL 14 dni; w sesji tylko `djId`.
- `SESSION_SECRET`: w produkcji brak sekretu lub < 32 znaki → wyjątek (fail closed; proxy rzuca tylko przy obecnym ciasteczku, więc niezalogowani nadal są przekierowywani). Fallback dev nieosiągalny przy `NODE_ENV=production` (`next start`/`next build` ustawiają to same). Sekret nie jest w repo (`.env*` w `.gitignore`, `.env.local` ignorowany).
- Enumeracja użytkowników przy logowaniu: ten sam komunikat i podobny czas (atrapa hasha). Rejestracja z definicji ujawnia zajęty e-mail — tego wymaga kryterium.
- Open redirect: brak parametru `next`/`returnTo`, przekierowania tylko na stałe ścieżki.
- CSRF: Server Actions w Next 16 odrzucają żądania z obcym `Origin` (porównanie z `Host`), do tego `sameSite=lax` i tylko POST. Wystarczające.
- `/panel/*`: optymistyczne sprawdzenie w `proxy.ts` (zgodnie z dokumentacją Next 16) + autorytatywne `requireDj()` z odczytem użytkownika z bazy (usunięte konto = brak dostępu). Zgodne z zaleceniem, by nie polegać wyłącznie na proxy.
- Walidacja zod po stronie serwera dla wszystkich pól (formularze mają `noValidate`, więc walidacja jest naprawdę serwerowa).

**Drobne (na później):**
1. Sesja bezstanowa: wylogowanie usuwa ciasteczko w przeglądarce, ale skradzione ciasteczko pozostaje ważne do 14 dni (brak listy unieważnień / wersji sesji). Do rozważenia przy zmianie hasła w przyszłości.
2. Brak limitu prób logowania/rejestracji (rate limiting) — warto dodać przed produkcją (bcrypt 12 rund to też potencjalny wektor DoS CPU).
3. Komunikat „Hasło jest za długie (maksymalnie 72 znaki)” — limit jest w bajtach, więc dla polskich liter próg jest niższy niż 72 znaki; można doprecyzować tekst.
4. Fallback sekretu zależy wyłącznie od `NODE_ENV`; gdyby ktoś wdrożył środowisko „staging” z innym `NODE_ENV`, użyje jawnego sekretu dev. Można rozważyć wymaganie `SESSION_SECRET` zawsze poza `test`/`development`.
5. Strony `/logowanie` i `/rejestracja` nie przekierowują zalogowanego DJ-a do panelu — kosmetyka UX.

REVIEW: APPROVE

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Drobne uwagi (rate limit logowania, przekierowanie zalogowanego z /logowanie, unieważnianie sesji) do rozważenia po MVP. Ticket zamknięty.
