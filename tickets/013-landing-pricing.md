---
id: "013"
title: Landing i cennik
status: todo
depends_on: ["003"]
attempts: 0
---

## Cel
Strona, która w kilka sekund tłumaczy DJ-owi, co dostaje, i prowadzi do rejestracji.

## Kryteria akceptacji
- [ ] `/`: nagłówek z obietnicą, sekcja „Jak to działa” (3 kroki: QR → goście dodają i lajkują → grasz to, co sala chce), korzyści dla DJ-ów weselnych, CTA „Załóż darmowe konto”
- [ ] `/cennik`: Free vs Pro zgodnie ze SPEC, ceny w PLN, CTA
- [ ] Nagłówek z linkami: Cennik, Zaloguj, Załóż konto (dla zalogowanego: Panel)
- [ ] Responsywne; metadane (title, description, Open Graph) po polsku
- [ ] Teksty z cennika pobierane z `lib/plans.ts`, jeśli już istnieje; w przeciwnym razie z jednej stałej
- [ ] e2e: z landingu przez CTA na `/rejestracja`

## Log
