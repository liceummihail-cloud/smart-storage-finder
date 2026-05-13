## Мета
Підготувати додаток до публікації в Play Market через Capacitor, з мінімальною прив'язкою до Lovable, та реалізувати залишкові функціональні запити (виправлення диктування, PIN/біометрія, туторіал, стіни в кімнаті, підписки).

## 1. Виправлення дублювання при диктуванні (Android)
Проблема в інтерфейсі браузера на телефоні: Web Speech API повертає проміжні (`interim`) результати, які додаються до тексту замість заміни. У вебпрегляді Lovable не відтворюється, бо використовується інший рушій розпізнавання.

Рішення:
- Розділити стан на `finalText` і `interimText`.
- В `onresult` перебирати всі `results`, накопичувати тільки ті, що `isFinal`, а проміжні зберігати окремо.
- Показувати конкатенацію `finalText + interimText` лише для відображення; у БД писати тільки `finalText`.
- Після `Capacitor` — переключитись на `@capacitor-community/speech-recognition` (нативне), яке працює стабільніше і офлайн.

## 2. PIN-код + біометрія
- Окрема таблиця `user_security` (user_id, pin_hash, biometric_enabled, created_at).
- При першому вході після email/пароля — пропозиція встановити PIN (4–6 цифр).
- На наступних відкриттях додатка — екран `/lock` з PIN-падом + кнопкою "Face ID / Відбиток".
- Хеш PIN через `bcrypt` на сервері (server function `setPin`, `verifyPin`).
- Біометрія — плагін `@capacitor-community/biometric-auth` (працює тільки в нативній збірці; у браузері — тільки PIN).
- Сесія Supabase лишається, lock-screen — додатковий шар, флаг у `localStorage` "розблоковано до закриття додатка".

## 3. Персистентність туторіалу
- Колонка `onboarded_at timestamptz` у `profiles` (вже може бути; перевірю).
- Touториал показується, коли `profiles.onboarded_at IS NULL`.
- Кнопка "пройти знову" — у налаштуваннях, скидає поле.
- Прибрати поточну логіку, що скидає прапорець при кожному вході.

## 4. Стіни в кімнаті
- Нова таблиця `walls` (id, room_id, name, position, created_at) з FK на `rooms` і RLS по власнику кімнати.
- У `containers` додати nullable `wall_id` (FK → walls). Якщо NULL — коробка належить кімнаті напряму (для зворотної сумісності).
- UI кімнати: вкладки/секції "Без стіни" + динамічно стіни. Кнопка "+ Стіна" (макс. 4–10).
- Drag-and-drop коробки між стінами (опційно, можна пізніше).

## 5. Підписки (3 тарифи)
- Таблиця `subscriptions` (user_id, tier `free`|`pro`|`premium`, started_at, expires_at, source `stripe`|`google_play`).
- Ліміти (server-side в `createServerFn`):
  - **Free**: 1 кімната, без стін, 50 предметів.
  - **Pro**: 10 кімнат, стіни, 1000 предметів, AI-пошук без обмежень.
  - **Premium**: безлім, експорт, шерінг кімнат з родиною.
- Сторінка `/upgrade` (вже є) — оновити з 3 планами.
- Платежі: спочатку Stripe (web), пізніше Google Play Billing через `@capacitor-community/in-app-purchases` для нативної збірки. Прийняти як двоетапний.

## 6. Capacitor — пакування під Android
- `bun add @capacitor/core @capacitor/cli @capacitor/android`.
- `npx cap init` з `appId: app.lovable.storage` (або власний reverse-DNS), `appName`.
- `capacitor.config.ts` з `webDir: 'dist'`, `server.androidScheme: 'https'`.
- Білд: `bun run build` → `npx cap add android` → `npx cap sync` → відкриття в Android Studio для AAB.
- Інструкція в `README-ANDROID.md` з кроками для локального білду.
- Плагіни: speech-recognition, biometric-auth, in-app-purchases, preferences (для PIN-стану).

## 7. Незалежність від Lovable (підготовка)
- Усі змінні env читаються з `.env` (вже так). При експорті з GitHub — `.env.example` з інструкцією.
- Документація в `MIGRATION.md`: як перенести Supabase на власний акаунт (SQL дамп + редагування `.env`), як замінити Lovable AI на власний ключ OpenAI/Gemini у `src/lib/ai.functions.ts`.
- На цьому етапі залишаємо Lovable Cloud активним — міграція тільки інструкція.

## Послідовність реалізації
Пропоную розбити на окремі повідомлення (щоб ти бачив результат поетапно):

1. **Спочатку**: виправлення диктування + персистентність туторіалу (швидко, без БД).
2. **Далі**: міграція БД (стіни, user_security, subscriptions) + UI стін.
3. **Потім**: PIN-код + 3 тарифи + ліміти.
4. **Окремо**: Capacitor setup + інструкції для Android Studio + плагіни біометрії та speech-recognition.
5. **В кінці**: документація `MIGRATION.md` + `README-ANDROID.md`.

## Питання перед стартом
- App ID для Play Market — `app.lovable.storage` чи власний (типу `com.твійдомен.storage`)?
- Stripe для веб-платежів зараз підключаємо чи поки тільки структура БД + сторінка планів без оплати?
- Максимум стін на кімнату — 4 (як у прикладі) чи без обмежень для Pro/Premium?
