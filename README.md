# ITRCRM

CRM-система для управління школою робототехніки та технологічних курсів. Система забезпечує управління учнями, групами, уроками, відвідуваністю та оплатами з рольовим розмежуванням доступу.

## Можливості

- **Автентифікація**: Сесійна авторизація з JWT-токенами та bcrypt-хешуванням паролів
- **Рольовий доступ**: Адміністратор (повний доступ) та Викладач (обмежений доступ)
- **Курси**: Каталог курсів з описом, віковими вимогами, тривалістю, програмою та флаєрами
- **Групи**: Управління групами з розкладом, призначеними викладачами, ціноутворенням та історією змін
- **Учні**: Картки учнів з контактами, батьками, датою народження, школою та знижками
- **Викладачі**: Профілі викладачів з фото, контактами та призначеними групами
- **Уроки**: Автогенерація уроків за розкладом групи, скасування та перенесення
- **Відвідуваність**: Відмітки з кількома статусами (присутній, відсутній, відпрацювання заплановано, відпрацювання виконано)
- **Оплати**: Помісячний облік оплат (готівка, переказ на рахунок)
- **Розклад**: Загальний розклад з генерацією уроків для всіх груп
- **Звіти**: Звіти відвідуваності, оплат та боргів з експортом у CSV
- **Налаштування**: Зміна профілю та пароля користувача
- **Локалізація**: Повна українська локалізація інтерфейсу

## Технологічний стек

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **База даних**: Neon PostgreSQL (serverless)
- **Автентифікація**: JWT + сесії з bcrypt-хешуванням
- **Зберігання файлів**: Cloudinary (фото викладачів, флаєри курсів)
- **Стилізація**: CSS Modules + глобальні стилі (без UI-фреймворків)
- **Анімації**: Motion (Framer Motion)
- **Іконки**: Lucide React
- **PDF**: pdf-lib, jsPDF, PDFKit
- **Деплой**: Vercel

## Встановлення

### Передумови

- Node.js 18+
- npm
- Обліковий запис Neon (neon.tech) для PostgreSQL
- Обліковий запис Cloudinary для зберігання файлів

### Налаштування

1. Клонувати репозиторій
2. Встановити залежності:
   ```bash
   npm install
   ```
3. Скопіювати `.env.local.example` у `.env.local` та заповнити змінні середовища
4. Запустити міграцію бази даних:
   ```bash
   npm run db:migrate:neon
   ```
5. (Опціонально) Заповнити базу тестовими даними:
   ```bash
   npm run db:seed:neon
   ```
6. Запустити сервер розробки:
   ```bash
   npm run dev
   ```

Після запуску відкрити `http://localhost:3000/login`.

## Змінні середовища

| Змінна | Опис |
|--------|------|
| `DATABASE_URL` | Connection string для Neon PostgreSQL |
| `CLOUDINARY_CLOUD_NAME` | Ім'я хмари Cloudinary |
| `CLOUDINARY_API_KEY` | API-ключ Cloudinary |
| `CLOUDINARY_API_SECRET` | API-секрет Cloudinary |
| `JWT_SECRET` | Секретний ключ для підпису JWT-токенів (мін. 32 символи) |
| `NODE_ENV` | Режим: `development` або `production` |

## Схема бази даних

| Таблиця | Призначення |
|---------|-------------|
| `users` | Користувачі системи (адміни, викладачі) |
| `courses` | Каталог курсів |
| `groups` | Навчальні групи з розкладом |
| `students` | Картки учнів |
| `student_groups` | Зв'язок учнів з групами (M:N) |
| `lessons` | Згенеровані уроки |
| `attendance` | Записи відвідуваності |
| `payments` | Записи оплат |
| `pricing` | Історія цін груп |
| `sessions` | Сесії автентифікації |
| `group_history` | Аудит-лог змін у групах |
| `error_logs` | Логування помилок |

## API-ендпоінти

### Автентифікація
- `POST /api/auth/login` — Вхід
- `POST /api/auth/logout` — Вихід
- `GET /api/auth/me` — Поточний користувач

### Курси
- `GET /api/courses` — Список курсів
- `POST /api/courses` — Створити курс (Admin)
- `GET /api/courses/[id]` — Деталі курсу
- `PUT /api/courses/[id]` — Оновити курс (Admin)
- `POST /api/courses/[id]/archive` — Архівувати курс (Admin)
- `GET /api/courses/[id]/groups` — Групи курсу
- `GET /api/courses/[id]/students` — Учні курсу
- `POST /api/courses/[id]/flyer` — Завантажити флаєр
- `GET /api/courses/[id]/program-pdf` — Згенерувати PDF програми

### Групи
- `GET /api/groups` — Список груп
- `POST /api/groups` — Створити групу (Admin)
- `GET /api/groups/[id]` — Деталі групи
- `PUT /api/groups/[id]` — Оновити групу (Admin)
- `POST /api/groups/[id]/archive` — Архівувати групу (Admin)
- `GET /api/groups/[id]/students` — Учні групи
- `POST /api/groups/[id]/students` — Додати учня до групи (Admin)
- `POST /api/groups/[id]/generate-lessons` — Згенерувати уроки
- `GET /api/groups/[id]/payments` — Статус оплат групи
- `GET /api/groups/[id]/history` — Історія змін групи

### Учні
- `GET /api/students` — Список учнів
- `POST /api/students` — Створити учня (Admin)
- `GET /api/students/[id]` — Деталі учня
- `PUT /api/students/[id]` — Оновити учня (Admin)
- `DELETE /api/students/[id]` — Архівувати учня (Admin)

### Викладачі
- `GET /api/teachers` — Список викладачів
- `POST /api/teachers` — Створити викладача (Admin)
- `GET /api/teachers/[id]` — Деталі викладача
- `PUT /api/teachers/[id]` — Оновити викладача (Admin)
- `DELETE /api/teachers/[id]` — Архівувати викладача (Admin)

### Уроки
- `GET /api/lessons` — Список уроків
- `GET /api/lessons/[id]` — Деталі уроку
- `PUT /api/lessons/[id]` — Оновити урок
- `GET /api/lessons/[id]/attendance` — Відвідуваність уроку
- `POST /api/lessons/[id]/attendance` — Зберегти відвідуваність
- `POST /api/lessons/[id]/cancel` — Скасувати урок
- `POST /api/lessons/[id]/reschedule` — Перенести урок

### Розклад
- `GET /api/schedule` — Отримати розклад
- `POST /api/schedule/generate-all` — Згенерувати уроки для всіх груп

### Звіти
- `GET /api/reports/attendance` — Звіт відвідуваності
- `GET /api/reports/payments` — Звіт оплат
- `GET /api/reports/debts` — Звіт боргів

### Налаштування
- `GET /api/settings` — Отримати налаштування
- `PUT /api/settings` — Оновити профіль
- `PUT /api/settings/password` — Змінити пароль

### Завантаження файлів
- `POST /api/upload` — Завантажити файл (Cloudinary)

### Користувачі
- `GET /api/users` — Список користувачів (Admin)
- `POST /api/users` — Створити користувача (Admin)

## Ролі та дозволи

### Адміністратор
- Повний доступ до всіх модулів
- Управління користувачами, курсами, групами, учнями, викладачами
- Доступ до оплат та фінансових звітів
- Архівування/відновлення сутностей
- Завантаження матеріалів та флаєрів

### Викладач
- Доступ лише до призначених груп
- Перегляд учнів своїх груп
- Відмітка відвідуваності та тем уроків
- Без доступу до оплат та фінансових даних
- Без можливості створення/зміни користувачів, курсів, груп, викладачів

## Структура проєкту

```
ITRobotCRM/
├── public/
│   └── uploads/                  # Локальні завантаження (legacy)
├── scripts/
│   ├── migrate-neon.js           # Міграція схеми на Neon PostgreSQL
│   ├── seed-neon.js              # Заповнення Neon тестовими даними
│   ├── seed.js                   # Заповнення локальної БД
│   ├── reset.js                  # Скидання БД
│   ├── backfill-public-ids.js    # Генерація публічних ID
│   └── verify-public-ids.js      # Верифікація публічних ID
├── src/
│   ├── middleware.ts              # Middleware автентифікації
│   ├── app/
│   │   ├── globals.css            # Глобальні стилі
│   │   ├── layout.tsx             # Кореневий layout
│   │   ├── page.tsx               # Головна сторінка
│   │   ├── (app)/                 # Захищені сторінки
│   │   │   ├── dashboard/         # Дашборд
│   │   │   ├── courses/           # Курси
│   │   │   ├── groups/            # Групи (список, деталі, створення, редагування)
│   │   │   ├── students/          # Учні
│   │   │   ├── teachers/          # Викладачі
│   │   │   ├── schedule/          # Розклад
│   │   │   ├── reports/           # Звіти
│   │   │   ├── settings/          # Налаштування
│   │   │   └── users/             # Управління користувачами (Admin)
│   │   ├── (auth)/                # Сторінки автентифікації
│   │   │   └── login/             # Сторінка входу
│   │   └── api/                   # API-маршрути
│   ├── components/                # React-компоненти
│   │   ├── Layout.tsx             # Основний layout з навігацією
│   │   ├── Header.tsx             # Заголовок сторінки
│   │   ├── DraggableModal.tsx     # Перетягуваний модальний компонент
│   │   ├── LoadingOverlay.tsx     # Оверлей завантаження
│   │   ├── SearchInput.tsx        # Поле пошуку
│   │   ├── IconButton.tsx         # Кнопка з іконкою
│   │   ├── Portal.tsx             # React Portal
│   │   ├── GroupHistoryPanel.tsx   # Панель історії змін групи
│   │   ├── *ModalsContext.tsx      # Контексти модальних вікон (Course, Group, Student, Teacher, Lesson)
│   │   ├── *ModalsManager.tsx     # Менеджери модальних вікон
│   │   ├── *ModalsProvider.tsx    # Провайдери модальних вікон
│   │   ├── *ModalsWrapper.tsx     # Обгортки модальних вікон
│   │   ├── Navbar/                # Навігаційна панель
│   │   └── Sidebar/               # Бічна панель
│   ├── db/
│   │   ├── index.ts               # Proxy до Neon PostgreSQL
│   │   ├── neon.ts                # Neon PostgreSQL клієнт
│   │   └── schema.sql             # SQL-схема (довідкова)
│   ├── i18n/                      # Локалізація
│   │   ├── uk.ts                  # Українські переклади
│   │   ├── t.ts                   # Функції перекладу
│   │   └── pluralUk.ts            # Українські множинні форми
│   └── lib/                       # Бізнес-логіка
│       ├── api-utils.ts           # Утиліти API
│       ├── auth.ts                # Автентифікація
│       ├── cloudinary.ts          # Інтеграція з Cloudinary
│       ├── courses.ts             # Операції з курсами
│       ├── date-utils.ts          # Утиліти дат
│       ├── groups.ts              # Операції з групами
│       ├── group-history.ts       # Історія змін груп
│       ├── lessons.ts             # Операції з уроками
│       ├── payments.ts            # Операції з оплатами
│       ├── public-id.ts           # Генерація публічних ID
│       ├── students.ts            # Операції з учнями
│       └── attendance.ts          # Операції з відвідуваністю
├── assets/
│   └── fonts/                     # Шрифти (Roboto)
├── tests/                         # Тести
├── .env.example                   # Шаблон змінних середовища
├── .env.local.example             # Шаблон локальних змінних
├── jest.config.js                 # Конфігурація Jest
├── next.config.js                 # Конфігурація Next.js
├── tsconfig.json                  # Конфігурація TypeScript
├── DEPLOY.md                      # Інструкція деплою
└── README.md                      # Цей файл
```

## Розробка

```bash
# Сервер розробки
npm run dev

# Збірка для production
npm run build

# Запуск production
npm start

# Production збірка + запуск
npm run prod

# Тести
npm test

# Міграція Neon PostgreSQL
npm run db:migrate:neon

# Заповнення Neon тестовими даними
npm run db:seed:neon

# Скидання локальної БД
npm run db:reset
```

## Деплой (Vercel)

1. Підключити репозиторій до Vercel
2. Додати змінні середовища (`DATABASE_URL`, `CLOUDINARY_*`, `JWT_SECRET`)
3. Запустити міграцію: `npm run db:migrate:neon`
4. Деплой відбувається автоматично при push

Детальніше — у [DEPLOY.md](DEPLOY.md).

## Ліцензія

MIT
