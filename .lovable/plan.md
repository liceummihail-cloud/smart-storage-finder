## Мета

Захистити проєкт від користувачів-зловмисників, які можуть з'їсти весь AI-бюджет. Зараз Pro = "необмежено" в коді — це ризик. Додаємо 3 рівні захисту без погіршення UX для нормальних користувачів.

Важливо: користуємось вбудованими можливостями Lovable. Жорсткого rate-limiting на рівні інфраструктури зараз немає — робимо програмний на рівні БД (підрахунок запитів за хвилину).

---

## 1. Ліміти для Pro (hard cap)

Розширити `FREE_LIMITS` у `src/lib/ai.functions.ts` на структуру з лімітами на план:

```text
free:    100 транскрипцій / 200 пошуків на місяць
pro:    5000 транскрипцій / 20000 пошуків на місяць
premium: без ліміту (або 50000/200000 для перестраховки)
```

У `extractItems` і `searchItems` прибрати спеціальну гілку "тільки free" — перевіряти ліміт для всіх планів за `LIMITS[plan]`. Premium — пропускати перевірку.

Користувач Pro в нормі робить ~50 транскрипцій/міс — у нього 100x запас. Бот вдариться об стіну.

## 2. М'який rate limit (60 запитів/хв на user)

Нова таблиця `ai_rate_limit`:
- `user_id uuid`
- `window_start timestamptz` (округлено до хвилини)
- `count int`
- PK (`user_id`, `window_start`)

Перед кожним викликом AI робимо `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`. Якщо count > 60 — кидаємо `LimitError("Забагато запитів. Зачекай хвилину.")`.

Старі рядки видаляє pg-функція раз на день (cron не потрібен — просто запит з LIMIT при кожному 100-му виклику).

## 3. Лог AI-витрат

Нова таблиця `ai_usage_log`:
- `user_id uuid`
- `created_at timestamptz default now()`
- `operation text` ('extract_items' | 'embed_save' | 'embed_search')
- `model text`
- `input_tokens int`
- `output_tokens int`
- `cost_usd numeric(10,6)` (рахуємо в коді за відомим прайсом)

Записуємо після кожного успішного виклику AI. Це дає:
- Топ-10 споживачів (`SELECT user_id, sum(cost_usd) FROM ai_usage_log WHERE created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`)
- Загальну собівартість на користувача
- Базу для майбутньої адмінки

RLS: користувач бачить тільки свої записи; service_role бачить усе.

## 4. Оновити сторінку Upgrade

У `src/routes/_authenticated/upgrade.tsx` чесно показати ліміти Pro:
- "До 5000 голосових / міс"
- "До 20000 пошуків / міс"

Замість поточного "Необмежено голосу і пошуків" — щоб користувач не очікував безмежності.

## Технічні деталі

**Файли, які зміняться:**
- `src/lib/ai.functions.ts` — нова мапа лімітів, `checkRateLimit()`, `logUsage()`, нові виклики у трьох місцях.
- `src/routes/_authenticated/upgrade.tsx` — оновлений текст features для Pro.
- Міграція: 2 нові таблиці (`ai_rate_limit`, `ai_usage_log`) + RLS.

**Підрахунок токенів:**
- Для chat completions беремо з `ai.usage.prompt_tokens` / `completion_tokens` що повертає gateway.
- Для embeddings — з `json.usage.total_tokens`.

**Прайс (хардкод у коді):**
```text
gemini-2.5-flash:    input  $0.30/M, output $2.50/M
gemini-embedding-001:           $0.15/M
```

**Що НЕ робимо у цій ітерації:**
- Не блокуємо доступ при перевитраті кредитів Lovable (це окрема задача).
- Не робимо UI адмінки (запит у БД достатньо для ручного моніторингу).
- Не алертимо в email/Telegram — додамо пізніше за потреби.

## Послідовність виконання

1. Міграція БД (2 таблиці + RLS).
2. Оновити `src/lib/ai.functions.ts`: ліміти, rate limit, лог.
3. Оновити `src/routes/_authenticated/upgrade.tsx`: чесні цифри Pro.
4. Перевірити що Free-користувач все ще впирається у свої 100/200, Pro — у 5000/20000.