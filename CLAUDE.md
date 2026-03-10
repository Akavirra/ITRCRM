# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test             # Run Jest tests

# Database (Neon PostgreSQL)
npm run db:migrate:neon   # Run migrations against Neon
npm run db:seed:neon      # Seed Neon database
```

## Environment Variables

Required in `.env.local`:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — Secret for JWT tokens
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Image uploads
- `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` — App base URL

## Architecture

**Stack:** Next.js 14 App Router, TypeScript, Neon (serverless PostgreSQL), deployed on Vercel.

**Database layer** (`src/db/`): `neon.ts` is the actual driver using `@neondatabase/serverless`. `index.ts` re-exports from it with compatibility stubs. Always import from `@/db`. Use `query`/`run` for writes, `get<T>` for single rows, `all<T>` for multiple rows. All SQL uses `$1`, `$2`... PostgreSQL-style parameters. The `transaction()` wrapper is a no-op (Neon serverless limitation).

**Business logic** (`src/lib/`): Domain modules — `lessons.ts`, `groups.ts`, `courses.ts`, `students.ts`, `payments.ts`, `auth.ts`, `telegram.ts`, `cloudinary.ts`. These contain the core data access functions called by API routes.

**API routes** (`src/app/api/`): All routes follow a pattern: call `getAuthUser(request)` from `@/lib/api-utils`, return `unauthorized()` if null, then handle business logic. Helper response functions: `unauthorized()`, `forbidden()`, `badRequest(msg)`, `notFound(msg)`.

**Auth:** Cookie-based sessions (`session_id` cookie). Middleware at `src/middleware.ts` checks the cookie and redirects to `/login` for unauthenticated requests. Only `admin` role can log in. Teachers interact via Telegram bot only.

**Modal system:** Each entity type (Groups, Students, Courses, Teachers, Lessons) has a Context/Provider/Manager/Wrapper set of files. Modals are draggable (`DraggableModal.tsx`) and their open/position/size state is persisted to `localStorage`. The `*ModalsContext` stores state, `*ModalsProvider` wraps the app, `*ModalsManager` renders the actual modal UI, `*ModalsWrapper` ties them together.

**i18n:** Ukrainian-only UI. Use `t(key)` from `@/i18n/t` for translations with dot-notation keys (e.g., `t('nav.dashboard')`). Plural forms use `tPlural(key, count)`. All translation strings live in `src/i18n/uk.ts`.

**Telegram integration** (`src/lib/telegram.ts`, `src/app/api/telegram/`): Teachers receive lesson reminders and can update attendance/topics via Telegram callbacks. Webhook at `/api/telegram/webhook`.

**Lesson scheduling:** Lessons are stored in UTC. `src/lib/lessons.ts` handles timezone conversion (`date-fns-tz`) using `fromZonedTime`/`toZonedTime`. Default timezone is `Europe/Kyiv`. `weekly_day` in DB uses 1-7 (Mon–Sun); JS uses 0-6 (Sun–Sat) — conversion is `weekly_day === 7 ? 0 : weekly_day`.

**Lesson rescheduling:** `PATCH /api/lessons/[id]/reschedule` moves a lesson to a new date/time. The original date is saved in `lessons.original_date` so future generation skips that slot (generation checks both `lesson_date` and `original_date`). Rescheduled lessons show a purple "Перенесено з..." badge on the schedule page and in the lesson modal. Migration to add `original_date`: `npm run db:add-lesson-original-date`.

**Reports:** `/api/reports/attendance`, `/api/reports/debts`, `/api/reports/payments` — generate CSV/PDF exports.

**App routes** (`src/app/(app)/`): Dashboard, students, teachers, groups, courses, reports, settings pages. Auth route group at `src/app/(auth)/login`.

**`export const dynamic = 'force-dynamic'`** is required on all API routes that read from the database, to prevent Next.js 14 from caching responses.
