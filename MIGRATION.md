# Міграція з Lovable Cloud на власний бекенд

Цей документ описує, як від'єднати додаток від Lovable Cloud і перевести його на власний Supabase + власні AI-ключі. Робиться один раз, ~30-60 хв.

## Що використовує Lovable Cloud зараз

1. **Supabase** (БД, auth, storage) — змінні `VITE_SUPABASE_*` у `.env`.
2. **Lovable AI Gateway** (OpenAI/Gemini без ключа) — секрет `LOVABLE_API_KEY`, використовується в `src/lib/ai.functions.ts`.

## Крок 1. Власний Supabase

1. Зареєструйся на [supabase.com](https://supabase.com) (є безкоштовний tier).
2. Створи новий проєкт, запам'ятай **Project URL** та **anon/publishable key**.
3. Експортуй схему з поточного Lovable Cloud:
   - У Lovable: **Cloud → Database → Tables → Export** (SQL dump).
4. Імпортуй дамп у новий Supabase: **SQL Editor → New query → вставити → Run**.
5. Експортуй дані (також через **Export** для кожної таблиці) і завантаж через **Table Editor → Import**.
6. Скопіюй storage-бакети (`room-photos`):
   - У старому Supabase: завантаж файли локально.
   - У новому: створи бакет з тими ж налаштуваннями і завантаж файли.
7. Перенеси користувачів (опційно): **Authentication → Users → Export/Import**.

## Крок 2. Власні AI-ключі

Відкрий `src/lib/ai.functions.ts`. Він зараз робить запити на Lovable AI Gateway (`https://ai.gateway.lovable.dev`).

**Заміни на:**

### Варіант A: OpenAI напряму

```ts
// замість fetch на Lovable Gateway
const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ model: "gpt-4o-mini", messages: [...] }),
});
```

Отримай ключ на [platform.openai.com](https://platform.openai.com).

### Варіант B: Google Gemini

```ts
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
  { method: "POST", body: JSON.stringify({ contents: [...] }) }
);
```

Отримай ключ на [aistudio.google.com](https://aistudio.google.com).

### Embeddings (для пошуку)

OpenAI `text-embedding-3-small` (підтримує 1536 dimensions, як у нашому `vector` стовпці).

## Крок 3. Оновити `.env`

```
VITE_SUPABASE_URL=https://твійпроект.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_URL=https://твійпроект.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
# або
GEMINI_API_KEY=AIza...
```

## Крок 4. Перебілдити

```bash
bun run build
npx cap sync android  # для мобілки
```

## Що робити з підпискою на Lovable?

Після міграції додаток повністю незалежний — підписку Lovable можна скасувати. Проєкт у Lovable можна залишити як архів або видалити.

## Чек-лист

- [ ] Створено новий Supabase проєкт
- [ ] Перенесено схему БД (таблиці, RLS, функції, тригери)
- [ ] Перенесено дані
- [ ] Перенесено storage
- [ ] Оновлено `src/lib/ai.functions.ts` на власний AI
- [ ] Оновлено `.env`
- [ ] Локальний білд працює
- [ ] Mobile-білд (Capacitor) працює
