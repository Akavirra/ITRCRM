# Деплой ITRCRM

## Мінімальний набір змінних на Vercel

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Додаткові змінні, якщо відповідні модулі увімкнені

- `CRON_SECRET`
- `OPENWEATHERMAP_API_KEY`
- `MEDIA_BOT_TOKEN`
- `MEDIA_BOT_SECRET`
- `TELEGRAM_SCHOOL_GROUP_ID`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

## Порядок деплою

1. Додати репозиторій у Vercel
2. Заповнити env variables
3. Переконатися, що `NEXT_PUBLIC_APP_URL` і `NEXTAUTH_URL` вказують на production URL
4. Переконатися, що `TELEGRAM_WEBHOOK_SECRET` заданий
5. Після першого деплою виконати:

```bash
npm run db:migrate:neon
```

6. За потреби виконати початкове наповнення:

```bash
npm run db:seed:neon
```

## Що перевірити після деплою

- `/login` відкривається і адмін може увійти
- основні сторінки адмінки завантажуються
- teacher / telegram сценарії працюють із production env
- webhook-и використовують актуальні секрети
- звіти, фото та Cloudinary-інтеграція працюють

## Зауваження

- Telegram callback більше не приймає запити без `TELEGRAM_WEBHOOK_SECRET`
- `.env.example` і `.env.local.example` варто тримати синхронними з реальним production setup
