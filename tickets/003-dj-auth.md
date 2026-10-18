---
id: "003"
title: Rejestracja i logowanie DJ-a
status: todo
depends_on: ["002"]
attempts: 0
---

## Cel
DJ może założyć konto, zalogować się i wylogować. Strony `/panel/*` są chronione.

## Kryteria akceptacji
- [ ] `/rejestracja`: email, nazwa wyświetlana, hasło (min. 8 znaków); duplikat emaila daje czytelny błąd po polsku
- [ ] `/logowanie`: błędne dane dają ogólny komunikat (bez zdradzania, czy email istnieje)
- [ ] Hasła hashowane bcryptem; sesja w ciasteczku httpOnly, secure w produkcji (iron-session, `SESSION_SECRET` w `.env.example`)
- [ ] Wylogowanie czyści sesję
- [ ] Middleware lub helper `requireDj()` przekierowuje niezalogowanych z `/panel/*` na `/logowanie`
- [ ] Testy jednostkowe walidacji i hashowania; e2e: rejestracja → panel → wylogowanie → logowanie

## Log
