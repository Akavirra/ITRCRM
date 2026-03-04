# ITRCRM — Інструкція деплою

## Змінні середовища (додати на Vercel)
- DATABASE_URL — Connection string з neon.tech
- CLOUDINARY_CLOUD_NAME — з cloudinary.com dashboard  
- CLOUDINARY_API_KEY — з cloudinary.com dashboard
- CLOUDINARY_API_SECRET — з cloudinary.com dashboard
- JWT_SECRET — довгий випадковий рядок (мін. 32 символи)

## Після першого деплою
1. Запустити міграцію БД: npm run db:migrate:neon
2. Перевірити /login — вхід тільки для admin
3. Перевірити /dashboard — посилання ведуть на /schedule
4. Перевірити додавання викладача з фото

## Локальна розробка
1. Скопіювати .env.local.example в .env.local
2. Заповнити всі змінні
3. npm run db:migrate:neon
4. npm run dev
