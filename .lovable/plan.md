# Гібридна модель платежів

Web-користувачі платять через Paddle, Android-користувачі через Google Play Billing. Обидва канали оновлюють одне поле `profiles.plan` через бекенд.

## Архітектура

```text
┌─────────────────┐         ┌──────────────────┐
│  Web (browser)  │────────▶│     Paddle       │
└─────────────────┘         │  (MoR, VAT inc.) │
                            └────────┬─────────┘
                                     │ webhook (verified)
                                     ▼
                            ┌──────────────────┐
                            │ Lovable Cloud DB │
                            │  profiles.plan   │
                            │  subscriptions   │
                            └────────▲─────────┘
                                     │ webhook (RTDN)
                            ┌────────┴─────────┐
                            │ Google Play      │
                            │ Billing (15%)    │
                            └────────▲─────────┘
                                     │
┌─────────────────┐                  │
│  Android APK    │──────────────────┘
│  (Capacitor)    │   in-app purchase
└─────────────────┘
```

Підписка прив'язана до user_id (а не до пристрою), тому користувач, що оплатив Pro в Android, отримує Pro і на сайті, і навпаки.

## Етап 1 — Web через Paddle (робимо зараз)

1. **Увімкнути Paddle** через Lovable (тестове середовище створиться одразу, для live — верифікація бізнесу).
2. **Створити продукти в Paddle:**
   - Pro — 79 ₴/міс (≈ $1.99/міс)
   - Premium — 199 ₴/міс (≈ $4.99/міс)
3. **БД-зміни:** таблиця `subscriptions` (provider, provider_subscription_id, status, current_period_end, plan, user_id) — щоб тримати історію і знати, звідки прийшла підписка.
4. **Checkout** на сторінці `/upgrade` — кнопки "Сповістити мене" замінити на робочі Paddle Checkout кнопки.
5. **Webhook** `/api/public/paddle-webhook` — перевіряє підпис Paddle, оновлює `profiles.plan` і `subscriptions`. Обробляє: `subscription.created`, `subscription.updated`, `subscription.canceled`, `transaction.completed`.
6. **Сторінка "Керування підпискою"** — кнопка "Скасувати" / "Змінити план" відкриває Paddle Customer Portal.

## Етап 2 — Android через Google Play Billing (окремо, після збірки APK)

Це **не можна зробити в Lovable preview** — потрібен реальний APK і Play Console. Кроки на майбутнє:

1. Capacitor plugin: `cordova-plugin-purchase` (підтримує Android + майбутній iOS).
2. У Play Console створити In-app products з тими самими ID (`pro_monthly`, `premium_monthly`).
3. Додати TanStack server route `/api/public/google-play-rtdn` — приймає Real-time Developer Notifications, верифікує покупку через Google Play Developer API (`androidpublisher.purchases.subscriptionsv2.get`), оновлює `profiles.plan` і `subscriptions`.
4. У застосунку: при відкритті екрана `/upgrade` детектити Capacitor (`Capacitor.isNativePlatform()`) і показувати або Paddle-кнопку, або native Google Play purchase flow.
5. Service account JSON від Google Cloud → секрет `GOOGLE_PLAY_SERVICE_ACCOUNT`.

## Технічна частина (Етап 1, що робимо зараз)

**Файли:**
- `supabase/migrations/...` — таблиця `subscriptions`, оновлення `profiles.plan` через webhook
- `src/lib/payments.functions.ts` — server fn `createCheckoutSession()`, `getSubscription()`, `openCustomerPortal()`
- `src/routes/api/public/paddle-webhook.ts` — server route з перевіркою підпису Paddle
- `src/routes/_authenticated/upgrade.tsx` — робочі кнопки Checkout, статус підписки
- `src/routes/_authenticated/billing.tsx` — нова сторінка керування підпискою

**Гарантія цілісності:**
- `profiles.plan` змінюється **тільки** через webhook (не з фронтенду) — бо інакше можна підробити.
- Webhook ідемпотентний: дубльовані події не подвоюють підписки.
- При закінченні `current_period_end` без `subscription.renewed` — cron-скрипт або lazy-check у server fn опускає план до `free`.

## Питання для вас

1. **Ціни в Paddle:** Paddle працює у валютах USD/EUR/GBP. Конвертуємо 79 ₴ ≈ $1.99 і 199 ₴ ≈ $4.99? Чи інші суми?
2. **Trial:** даємо 7 днів безкоштовного Pro для нових юзерів?
3. **Етап 2 (Google Play):** робимо план зараз для довідки, чи відкладаємо до моменту, коли будете готові збирати APK?

Після відповідей створю міграцію БД і починаю Етап 1.
