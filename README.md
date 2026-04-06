# ITRCRM

CRM-система для школи робототехніки на `Next.js 14`, `TypeScript` і `Neon PostgreSQL`.

## Можливості

- адмін-панель для курсів, груп, учнів, викладачів, уроків, оплат і звітів
- Telegram Mini App / teacher app для викладачів
- Telegram webhook-и для callback-ів, нагадувань і медіа-сценаріїв
- перенесення, скасування й автогенерація уроків
- Cloudinary для фото та медіа
- CSV/PDF-експорти

## Стек

- `Next.js 14` (`App Router`)
- `React 18`
- `TypeScript`
- `Neon PostgreSQL` через `@neondatabase/serverless`
- `Cloudinary`
- `Jest`

## Актуальна модель авторизації

- веб-частина працює через `session_id` cookie і таблицю `sessions`
- у веб-адмінку можуть входити лише користувачі з роллю `admin`
- викладачі працюють через Telegram Mini App / Telegram bot flow
- частина службових endpoint-ів використовує секрети (`CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `MEDIA_BOT_SECRET`)

## Швидкий старт

1. Встановити залежності:

```bash
npm install
```

2. Скопіювати `.env.local.example` у `.env.local`

3. Заповнити потрібні env-змінні

4. Прогнати міграції:

```bash
npm run db:migrate:neon
```

5. За потреби заповнити тестові дані:

```bash
npm run db:seed:neon
```

6. Запустити проєкт:

```bash
npm run dev
```

Після запуску відкривати `http://localhost:3000/login`.

## Основні команди

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test

npm run db:migrate:neon
npm run db:seed:neon
```

## Змінні середовища

### Мінімум для запуску

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL` або `NEXTAUTH_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Додаткові інтеграції

- `CRON_SECRET`
- `OPENWEATHERMAP_API_KEY`
- `MEDIA_BOT_TOKEN`
- `MEDIA_BOT_SECRET`
- `TELEGRAM_SCHOOL_GROUP_ID`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

Актуальний шаблон: `.env.local.example`.

## Архітектура

### База даних

- використовуй імпорт тільки з `@/db`
- основний драйвер: `src/db/neon.ts`
- `transaction()` у цьому проєкті не дає справжньої транзакційності для Neon HTTP driver

### Бізнес-логіка

- доменні модулі лежать у `src/lib`
- API-роути лежать у `src/app/api`
- для DB-backed route-ів потрібен `export const dynamic = 'force-dynamic'`

### Ролі

- `admin` — веб-адмінка
- `teacher` — Telegram / Mini App сценарії

## Важливі модулі

- `src/app/api/teacher-app/*` — teacher mini app
- `src/app/api/admin-app/*` — admin mini app / telegram web app сценарії
- `src/app/api/telegram/*` — Telegram інтеграції
- `src/app/api/enrollment/*` та `src/app/api/enroll/*` — enrollment flow
- `src/app/api/media/*` — media webhook setup і пов'язані endpoint-и
- `src/app/api/notes/*` — нотатки та нагадування
- `src/app/api/weather/*` — weather widget

## Тести

- `npm test` запускає `Jest`
- поточні unit-тести лежать у `tests`

## Документація деплою

Інструкції з деплою дивись у `DEPLOY.md`.
