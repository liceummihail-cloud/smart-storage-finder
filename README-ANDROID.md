# Збірка Android-додатку (Play Market)

Цей проєкт пакується в нативний Android-додаток через **Capacitor**.

## Передумови (одноразово)

1. **Node.js 20+** і **bun** (або npm).
2. **Android Studio** (з Android SDK 34+).
3. **JDK 17** (зазвичай встановлюється з Android Studio).
4. Налаштований `JAVA_HOME` та `ANDROID_HOME`.

## Перший запуск

```bash
# 1. Клонувати з GitHub
git clone <твій-repo>
cd <repo>

# 2. Встановити залежності
bun install

# 3. Створити .env (скопіюй з .env.example і заповни)
cp .env.example .env

# 4. Зібрати веб-частину
bun run build

# 5. Додати Android-платформу (тільки перший раз)
npx cap add android

# 6. Синхронізувати з нативним проєктом
npx cap sync android

# 7. Відкрити в Android Studio
npx cap open android
```

## Після зміни коду

```bash
bun run build
npx cap sync android
```

## Збірка APK / AAB

У Android Studio:
- **Build → Generate Signed Bundle / APK** → AAB для Play Market.
- Створи keystore (один раз) і збережи його в безпечному місці — без нього не оновиш додаток.

## Дозволи в `AndroidManifest.xml`

Перевір, що додано:
- `RECORD_AUDIO` (для голосового вводу)
- `INTERNET`
- `USE_BIOMETRIC` (для біометрії, якщо ввімкнено)

## Плагіни Capacitor (встановлені)

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- `@capacitor/preferences` — локальне сховище для PIN-стану

**Опціонально для майбутнього:**
- `@capacitor-community/speech-recognition` — нативне розпізнавання
- `@capacitor-community/biometric-auth` — Face ID / відбиток
- `cordova-plugin-purchase` (через Capacitor) — Google Play Billing

## Публікація в Play Market

1. Створи акаунт розробника ($25 одноразово).
2. Створи додаток у Play Console.
3. Завантаж AAB.
4. Заповни картку (опис, скріншоти, політика конфіденційності).
5. Надішли на review (~1-3 дні).

## Важливо

- `appId` у `capacitor.config.ts` — `app.lovable.storage`. Зміни на власний reverse-DNS перед першою публікацією (наприклад, `com.tvoyabrand.storage`). Після публікації — змінити неможливо.
- `.env` має містити робочі URL/ключі Lovable Cloud (або власні Supabase + AI-ключі — див. `MIGRATION.md`).
