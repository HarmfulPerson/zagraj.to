---
id: "004"
title: Zarządzanie wydarzeniami w panelu
status: todo
depends_on: ["003"]
attempts: 0
---

## Cel
DJ tworzy, przegląda, edytuje i zmienia status swoich wydarzeń.

## Kryteria akceptacji
- [ ] `/panel` pokazuje listę wydarzeń zalogowanego DJ-a (nazwa, data, status, kod), od najnowszych
- [ ] `/panel/wydarzenia/nowe`: nazwa (wymagana), data (opcjonalna), limit życzeń na gościa (1–20, domyślnie 5); po zapisie wydarzenie ma unikalny kod i status DRAFT
- [ ] Akcje: „Rozpocznij” (DRAFT → LIVE), „Zakończ” (LIVE → CLOSED), edycja nazwy i limitu
- [ ] API sprawdza własność: próba zmiany cudzego wydarzenia zwraca 404 (test)
- [ ] Walidacja zod na wszystkich wejściach
- [ ] Testy jednostkowe przejść statusów (niedozwolone przejścia, np. CLOSED → LIVE, są odrzucane)

## Uwagi
Limity planu Free dochodzą w tickecie 011. Tutaj ich nie implementuj.

## Log
