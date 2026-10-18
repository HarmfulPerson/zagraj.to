---
id: "012"
title: Subskrypcja przez Stripe
status: todo
depends_on: ["011"]
attempts: 0
---

## Cel
DJ może kupić plan Pro i zarządzać subskrypcją.

## Kryteria akceptacji
- [ ] `/panel/subskrypcja`: aktualny plan, data odnowienia, przycisk „Przejdź na Pro” (Stripe Checkout, tryb subscription, PLN) albo „Zarządzaj subskrypcją” (Customer Portal)
- [ ] Webhook `POST /api/stripe/webhook` z weryfikacją podpisu obsługuje `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` i aktualizuje `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `planRenewsAt`
- [ ] Webhook jest idempotentny (ponowne doręczenie tego samego zdarzenia niczego nie psuje)
- [ ] Zmienne `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO` w `.env.example`
- [ ] Testy z zamockowanym SDK Stripe: każde zdarzenie, zły podpis daje 400
- [ ] Bez kluczy w env strona subskrypcji pokazuje „Płatności nie są skonfigurowane” zamiast się wysypywać

## Uwagi
Kod i testy da się zrobić bez kluczy. Ręczny test end-to-end wymaga konta Stripe w trybie testowym. To zostaw człowiekowi i opisz w Logu kroki (utworzenie produktu i ceny, `stripe listen`), ale **nie** ustawiaj `needs-human`, jeśli testy z mockami przechodzą.

## Log
