
# План оновлення додатку

Розбиваємо на 3 фази. Після кожної — перевіряємо в preview, тоді переходимо до наступної.

---

## ФАЗА 1 — Тарифи, ліміти, AI usage tracking

### База даних
- `subscription_plan` enum: додати `yearly`, прибрати `premium` (мігрувати існуючих premium → yearly).
- `profiles`: додати `language text default 'en'`.
- `usage_counters`: додати `day date`, `transcriptions_day`, `searches_day` (денні лічильники). Унікальність по `(user_id, month, day)` або окрема таблиця `usage_counters_daily` — виберу окрему таблицю щоб не ламати існуючу.
- `ai_usage_log`: вже існує — переконатись що поля відповідають (user_id, operation, model, input_tokens, output_tokens, cost_usd, created_at). Додати індекс по `(user_id, created_at)`.
- Тригери `enforce_free_rooms_limit`, `enforce_walls_plan_limit`, `enforce_free_containers_limit` — оновити під нові ліміти (FREE: 1/1/20, PRO: 10/5/50, YEARLY: 15/7/75). Додати тригер на ліміт предметів у коробці (50/100/100).
- RPC `get_monthly_ai_cost(user_id)` — для alert > $0.50/міс (показуватиметься у UI як warning банер).

### Ліміти (`src/lib/ai.functions.ts`)
```
PLAN_LIMITS = {
  free:   { transcriptions: 100,  searches: 50,   daily_transcriptions: 10 },
  pro:    { transcriptions: 1000, searches: 5000, daily_transcriptions: 50 },
  yearly: { transcriptions: 1500, searches: 7500, daily_transcriptions: 75 },
}
```
- Зберегти rate limit 60/хв.
- При перевищенні місячного/денного ліміту кидати `LimitError` з полем `upgradeRequired: true`.

### UI
- Оновити `/upgrade`: 3 плани (Free, Pro $4.99/міс, Yearly $49.99/рік). Прибрати Premium.
- Глобальний `<UpgradeDialog>` що ловить `LimitError` → показує модалку з кнопкою «Перейти на Pro/Yearly».
- Банер у `/rooms` при витратах AI > $0.50/міс.
- Експорт CSV/PDF — кнопка в `/rooms` і в кімнаті, доступна тільки для pro/yearly. CSV генеруємо клієнтом, PDF через `jspdf`.

### Тести
- Перевірка ліміту FREE: створити 2-у кімнату → помилка.
- Транскрипція 11-й раз за день на FREE → блок.

---

## ФАЗА 2 — Стіни, переміщення, редагування маркерів

### База даних
- Таблиця `walls` вже існує. Перевірити поля: `id, room_id, user_id, name, photo_url, created_at`. Додати `coords jsonb` для маркерів якщо немає.
- `containers`: додати `wall_id uuid references walls`. Існуючий `room_id` залишити (для денормалізації/переміщення між кімнатами).
- **Міграція даних**: для кожної кімнати без стіни → створити стіну «Основна» (photo_url = photo кімнати, якщо є), оновити всі контейнери цієї кімнати → `wall_id = id нової стіни`.
- `containers.position` (jsonb `{x, y}`) — координати маркера на фото стіни.

### UI / роути
- Новий роут `/_authenticated/rooms_.$roomId.walls_.$wallId.tsx` — екран стіни з фото + маркерами.
- На екрані кімнати — список стін (сітка карток з фото). Кнопка «+ Додати стіну» (вимагає фото).
- На екрані стіни:
  - Кнопка «Оновити фото» → камера/завантаження → після збереження автоматично включається режим редагування маркерів.
  - Кнопка «Редагувати розташування» (тільки pro/yearly) — маркери стають draggable, кнопки «Зберегти»/«Скасувати».
  - Тап на маркер → bottom sheet з опціями: Відкрити, Перемістити (pro/yearly), Видалити.
- «Перемістити»: модалка вибору `room → wall`, після переносу — питання «Оновити фото старої стіни?».

### Технічно
- Drag через pointer events (нативно, без бібліотек). Координати зберігаємо в % від розміру фото.
- Серверні функції: `createWall`, `updateWallPhoto`, `updateMarkerPositions`, `moveContainer`.

---

## ФАЗА 3 — Інтернаціоналізація + Google Play Billing заглушка

### i18n
- Бібліотека `i18next` + `react-i18next`.
- Папка `src/i18n/locales/{uk,en,pl,de,es,fr}.json`.
- Автовизначення: `navigator.language` → якщо немає в списку → `en`.
- Зберігати в `profiles.language`. При логіні підтягувати; при зміні в налаштуваннях оновлювати profile + локально.
- Перекласти усі UI-рядки (Free, Pro, Yearly, кімната, стіна, коробка, кнопки, помилки лімітів).
- Транскрипцію Gemini не чіпаємо — він і так multilingual.

### Google Play Billing (заглушка)
- Server route `src/routes/api/public/google-play-webhook.ts`:
  - Приймає `{ purchaseToken, productId, userId }`.
  - **Верифікація вимкнена** — TODO коментар з посиланням на Google Play Developer API.
  - Мапить `productId` → `pro` або `yearly`, створює запис у `subscriptions` (provider='google_play'), тригер `sync_user_plan_from_subscription` оновить plan.
- Cron-функція (через pg_cron або daily server route): для всіх активних `google_play` підписок з `current_period_end < now()` → status='expired' → тригер поверне plan на free.
- Документація для подальшого вмикання верифікації (які секрети додати: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `ANDROID_PACKAGE_NAME`).

---

## Технічні деталі

**Структура БД після всіх фаз:**
```text
profiles (plan: free|pro|yearly, language, trial_ends_at, ...)
rooms (user_id, name, photo_url)
  └─ walls (room_id, user_id, name, photo_url)
       └─ containers (wall_id, room_id, user_id, label, position: {x,y})
            └─ items (container_id, user_id, name, embedding)
subscriptions (provider: manual|paddle|google_play, status, plan, ...)
usage_counters (місячні)
usage_counters_daily (денні — нова таблиця)
ai_usage_log (детальний лог)
ai_rate_limit (60/хв)
```

**Що НЕ зачіпаємо:**
- `src/integrations/supabase/*` (автогенеровані)
- Логіку транскрипції/embedding в `ai.functions.ts` (тільки оновлюємо ліміти)
- Paddle checkout — зараз все ще заглушка, чекаємо коли підключите Paddle окремо.

**Ризики:**
- Міграція стін: якщо в когось вже є дані, треба бекап перед запуском. Зараз тестова стадія — низький ризик.
- Drag маркерів на мобільному в WebView (Capacitor) — перевіримо що pointer events працюють.

Готовий починати з Фази 1. Підтвердіть план — і перемикайте в build mode.
