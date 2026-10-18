---
id: "005"
title: Kod QR i plakat do druku
status: todo
depends_on: ["004"]
attempts: 0
---

## Cel
DJ ma QR prowadzący gości na stronę wydarzenia i może wydrukować plakat.

## Kryteria akceptacji
- [ ] Helper buduje URL gościa `${NEXT_PUBLIC_APP_URL}/e/<code>` (zmienna w `.env.example`)
- [ ] Na stronie wydarzenia w panelu widoczny QR (biblioteka `qrcode`, SVG), kod tekstowy i przycisk „Kopiuj link”
- [ ] `/panel/wydarzenia/[id]/plakat`: układ A4 (CSS `@media print`), nazwa wydarzenia, duży QR, kod tekstowy i hasło „Zeskanuj i zamów piosenkę”
- [ ] Przycisk „Drukuj” wywołuje `window.print()`, a elementy nawigacji są ukryte na wydruku
- [ ] Test jednostkowy budowania URL; e2e: plakat renderuje się z poprawnym kodem

## Log
