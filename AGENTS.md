# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository. The reader is expected to know nothing about the project beforehand.

---

## Project Overview

ITRCRM (`school-admin-panel`) is a CRM system for a robotics school. It provides:

- A web admin panel for managing courses, groups, students, teachers, lessons, payments, attendance, and reports.
- A Telegram Mini App / teacher-app for teachers to manage lessons, attendance, and upload media.
- A student portal (`/s/*`) with PIN-based authentication.
- Enrollment forms with magic-link tokens (`/enroll/[token]`).
- Summer camp management (camps, shifts, days, participants, payments).
- An AI assistant chat endpoint.
- CSV/PDF report generation.
- Google Drive integration for lesson materials and photo folders.
- Cloudinary for generic image uploads.
- Telegram bot webhooks for reminders, callbacks, and media handling.

The project is Ukrainian-language. All user-facing UI strings are in plain UTF-8 Cyrillic.

---

## ⚠️ CRITICAL: File encoding

**All files in this repo MUST be read and saved as UTF-8 with LF line endings.**

This repo is Ukrainian-language. In the past, files were silently re-encoded as Windows-1251 (cp1251), producing mojibake like `РќРµРґС–Р»СЏ` (which is `Неділя` double-encoded through UTF-8 → cp1251 → UTF-8). Restoring the file required rewriting hundreds of strings.

### Mandatory rules

1. **Writing files:** use UTF-8 explicitly. Never use `windows-1251`, `cp1251`, `latin-1`, or "system default" — especially on Windows, where the OEM codepage may be 1251/1252. If your file-write API accepts an encoding argument, pass `utf-8`.
2. **Reading files:** decode as UTF-8. If you see byte sequences like `Р`, `С`, `в”`, `вЂ`, `рџ`, `В°` inside Ukrainian text, **stop immediately**. That is mojibake, not content. Do not preserve it, do not propagate it across edits. Flag it to the user and recover the intended UTF-8 original.
3. **Do not add a BOM.** Node/Next.js dislikes BOM in `.ts`/`.tsx`/`.json`.
4. **Line endings:** LF only. Respect [`.editorconfig`](.editorconfig) (`end_of_line = lf`) and [`.gitattributes`](.gitattributes) (`*.ts text eol=lf`).
5. **Ukrainian is the UI language.** User-facing strings must be plain UTF-8 Cyrillic — never transliteration, never HTML entities like `&#1053;`.

### Mojibake cheat-sheet

If you see any of these in source, the file is already corrupted — do not commit, do not "adjust around it", recover it:

| Visible in file | Actual character | Meaning |
|---|---|---|
| `РќРµРґС–Р»СЏ` | `Неділя` | Sunday (example of double-encoded Cyrillic) |
| `В°` | `°` | degree sign |
| `вЂ”` | `—` | em-dash |
| `вЂ“` | `–` | en-dash |
| `в†’` / `в†ђ` | `→` / `←` | arrows |
| `в‚ґ` | `₴` | hryvnia |
| `рџ‘‹` / `рџ¤–` / `рџ”Ґ` | `👋` / `🤖` / `🔥` | emoji |
| `в”Ђ` | `─` | box-drawing line |

### Verify before committing

```bash
# Detect mojibake in staged changes. Must print "OK".
git diff --cached | grep -E "Р[А-Яа-я]|СЏ|С–|С‚|вЂ|рџ|В°|в‚|в†|в”" && echo "MOJIBAKE DETECTED — do not commit" || echo "OK"
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.3 (strict mode) |
| UI Library | React 18 |
| Styling | Plain CSS / CSS variables (no Tailwind) |
| Database | Neon serverless PostgreSQL (`@neondatabase/serverless`) |
| Auth | Cookie-based sessions (`session_id` / `student_session`) |
| Tests | Jest + ts-jest |
| Icons | Lucide React only (`lucide-react`) |
| Animation | `motion` (Framer Motion successor) |
| PDF | `jspdf`, `pdf-lib`, `pdfkit` |
| AI SDK | `ai`, `@ai-sdk/openai` |
| Validation | `zod` |
| Deployment | Vercel (`output: 'standalone'`) |
| Upload Service | Fastify 4 + `@fastify/multipart` (separate microservice in `upload-service/`) |

---

## 🎨 Design & UI work

Any time you write, edit, or review UI code (components, pages, modals, animations, CSS), you **must** apply the design-engineering philosophy of Emil Kowalski — that is the bar for UI in this project.

### For Claude Code (and other Claude-based agents)

Invoke the `emil-design-eng` skill **before** producing UI code. Use it for:
- Animation decisions (duration, easing, whether to animate at all)
- Component polish (`:active` states, focus rings, hover scoping, micro-feedback)
- Reviewing diffs on `.tsx` / `.css` files
- Any "make this feel better" request

When reviewing, output in the required Before/After/Why markdown table format from the skill.

### For Codex CLI, Copilot, and any agent without skill access

Follow the same philosophy manually. Canonical reference: Emil Kowalski's course at [animations.dev](https://animations.dev/). Core rules you must respect:

1. **Never use `transition: all`.** Specify exact properties: `transition: transform 200ms var(--ease-out), background 150ms ease`.
2. **Favor `ease-out` over `ease-in` for entries.** `ease-in` feels sluggish; `ease-out` gives instant feedback.
3. **Scale from 0.95–0.98, not from 0.** Nothing in the real world appears from nothing. `scale(0.95); opacity: 0` → `scale(1); opacity: 1`.
4. **Every interactive element needs a `:active` state.** Usually `transform: scale(0.97)` or `scale(0.98)`. Buttons must feel responsive to press.
5. **Gate hover behind pointer-fine devices:** `@media (hover: hover) and (pointer: fine) { .x:hover { ... } }`. Touch devices get stuck hover states otherwise.
6. **Animation frequency rule:**
   - 100+/day (keyboard shortcuts, command palette) → **no animation**
   - Tens/day (hover, list nav) → **minimal or none**
   - Occasional (modals, drawers) → **standard animation** (~200–300ms)
   - Rare (onboarding, celebrations) → delight is OK
7. **Respect `prefers-reduced-motion: reduce`.** Disable transforms; shorten transitions.
8. **Popovers scale from their trigger** (`transform-origin` tied to trigger position); **modals stay centered**.
9. **Unseen details compound.** The goal is not to be noticed — it's for interactions to feel inevitable.

### Project-specific design rules

The visual system (colors, typography, 4px spacing grid, 8/12px radii, Lucide icons, component rules) is codified in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). The Emil-philosophy rules above describe **how** things should feel; DESIGN_SYSTEM.md describes **what** they should look like. Both apply, always.

---

## Project Structure

```
src/
  app/              # Next.js App Router pages & API routes
  components/       # React components (modals, layouts, shared UI)
  lib/              # Business logic & domain modules
  db/               # Database driver & re-exports
  i18n/             # Ukrainian translations
  middleware.ts     # Auth, CSRF, routing, security headers
```

### App routes

| Route group | Path | Audience | Notes |
|---|---|---|---|
| `(app)` | `/dashboard`, `/schedule`, `/students`, `/groups`, `/courses`, `/teachers`, `/payments`, `/reports`, `/attendance`, `/materials`, `/enrollment`, `/users`, `/certificates` | Admin | Protected by `session_id` cookie. Layout: sidebar + navbar. |
| `(auth)` | `/login` | Admin | Unauthenticated layout. |
| `teacher-app` | `/teacher-app`, `/teacher-app/lesson/[id]`, `/teacher-app/groups`, `/teacher-app/profile` | Teacher | Mobile-optimized teacher app. |
| `admin-app` | `/admin-app`, `/admin-app/notifications`, `/admin-app/profile` | Admin | Mobile/PWA admin app. |
| `s` (student portal) | `/s/login`, `/s/dashboard`, `/s/groups`, `/s/schedule`, `/s/attendance`, `/s/profile` | Student | PIN-based auth (`student_session` cookie). Rewritten from `students.*` subdomain. |
| `enroll` | `/enroll/[token]` | Public | Enrollment form with magic-link tokens. |
| `tg-app` | `/tg-app` | Public | Telegram Mini App entry. |

### API routes (`src/app/api/`)

Organized by domain. All database-reading routes must export `dynamic = 'force-dynamic'`.

Key namespaces:
- `api/auth/*` — Admin session auth (`login`, `logout`, `me`, `profile`).
- `api/student/auth/*` — Student portal auth.
- `api/students/*`, `api/groups/*`, `api/lessons/*`, `api/courses/*`, `api/teachers/*` — Core entity CRUD + operations.
- `api/payments/*`, `api/attendance/*`, `api/schedule/*` — Payments, attendance, scheduling.
- `api/teacher-app/*`, `api/admin-app/*` — Mobile app APIs.
- `api/telegram/*` — Telegram bot webhooks and callbacks.
- `api/enrollment/*`, `api/enroll/*` — Enrollment flow.
- `api/media/*`, `api/lesson-media/*`, `api/photos/*` — Google Drive & Cloudinary media handling.
- `api/camps/*` — Summer camp management.
- `api/assistant/chat` — AI assistant endpoint.
- `api/reports/*` — CSV/PDF exports.
- `api/notifications/*` — Reminders, birthdays, Telegram notifications.
- `api/notes/*` — Notes & reminders.
- `api/weather/*` — Weather API proxy.
- `api/upload` — Generic Cloudinary upload handler.
- `api/public/courses` — Public unauthenticated course list.

### Business logic (`src/lib/`)

Domain modules contain core data access functions called by API routes:

| Module | Purpose |
|---|---|
| `auth.ts` | Session management, password hashing, group access control. |
| `api-utils.ts` | `getAuthUser(request)`, `unauthorized()`, `forbidden()`, `badRequest(msg)`, `notFound(msg)`. |
| `students.ts`, `students-page.ts` | Student CRUD, status logic, search, list-page data. |
| `student-auth.ts`, `student-credentials.ts` | Student portal PIN-based auth. |
| `groups.ts`, `group-history.ts` | Group CRUD, lesson generation, rescheduling, graduation, audit trail. |
| `lessons.ts` | Lesson scheduling, timezone handling, attendance, rescheduling with `original_date`. |
| `lesson-photos.ts`, `lesson-media.ts` | Photo and media file management for lessons. |
| `courses.ts` | Course catalog management. |
| `teachers.ts` | Teacher CRUD, salary calculation. |
| `payments.ts`, `individual-payments.ts`, `payments-page.ts` | Payment records, balances, page data. |
| `attendance.ts`, `trial-attendance.ts` | Attendance tracking & trial lesson handling. |
| `dashboard.ts` | Dashboard statistics. |
| `enrollment.ts` | Electronic enrollment form logic. |
| `camps.ts`, `camp-shifts.ts`, `camp-participants.ts`, `camp-payments.ts` | Summer camp domain. |
| `certificates.ts` | Certificate generation & PDF rendering. |
| `notifications.ts`, `telegram.ts` | Push/email/Telegram notifications & bot callbacks. |
| `cloudinary.ts`, `upload-service.ts`, `client-photo-upload.ts` | Image upload handling. |
| `google-drive.ts`, `google-photos.ts` | Google Drive/Photos integration for lesson materials. |
| `media/` | `files.ts`, `folders.ts`, `topics.ts` — Media organization. |
| `assistant/` | `chat.ts`, `tools.ts`, `guardrails.ts`, `date-utils.ts`, `provider-failover.ts`, `quick-replies.ts`, `tool-result-fallback.ts`, `constants.ts` — AI assistant backend logic. |
| `audit-events.ts` | Audit logging. |
| `env.ts` | Runtime environment variable validation. |
| `public-id.ts` | Public ID generation (for enrollment tokens, etc.). |
| `date-utils.ts`, `ukrainian-holidays.ts` | Date manipulation & holiday calendar. |
| `search.ts` | Global search logic. |
| `server-cache.ts` | Server-side caching utilities. |
| `weather.ts` | Weather API integration. |

### Components (`src/components/`)

Key patterns:
- **Layout & Shell:** `Layout.tsx`, `Sidebar/Sidebar.tsx`, `Navbar/`, `Header.tsx`, `PageTransitionProvider.tsx`.
- **Modal System:** Each entity has a Context/Provider/Manager/Wrapper quartet (Groups, Students, Courses, Teachers, Lessons, Camps). Modals are draggable (`DraggableModal.tsx`) and their open/position/size state is persisted to `localStorage`.
- **Student Portal:** `src/components/student/` — `StudentLoginForm.tsx`, `StudentShell.tsx`, `LessonRow.tsx`.
- **Camp Components:** `src/components/camp/` — `CampOverviewTab.tsx`, `CampParticipantsTab.tsx`, `CampPaymentsTab.tsx`, `CampsTab.tsx`.
- **Shared UI:** `Toast/`, `GlobalSearch/`, `ErrorBoundary.tsx`, `LoadingOverlay.tsx`, `IconButton.tsx`, `Portal.tsx`.
- **Providers:** `UserContext.tsx`, `NotesProvider.tsx`, `MediaViewerProvider.tsx`, `CalculatorProvider.tsx`, `TelegramWebAppProvider.tsx`.

---

## Database Layer (`src/db/`)

- **Driver:** `neon.ts` uses `@neondatabase/serverless`.
- **Import path:** Always import from `@/db`. `index.ts` re-exports from `neon.ts` with compatibility stubs.
- **API:**
  - `query` / `run` — for writes.
  - `get<T>` — for single rows.
  - `all<T>` — for multiple rows.
- **Parameters:** All SQL uses PostgreSQL-style numbered parameters (`$1`, `$2`...).
- **Transactions:** `transaction()` wrapper is a no-op due to Neon serverless HTTP driver limitations.
- **Student isolation:** `src/db/neon-student.ts` provides a separate connection config for the student portal.

### Schema highlights (29 tables)

Core tables: `users`, `students`, `courses`, `groups`, `lessons`, `student_groups`, `attendance`, `payments`, `individual_payments`, `individual_balances`, `pricing`, `lesson_teacher_replacements`, `lesson_change_logs`.

Supporting tables: `sessions`, `enrollment_tokens`, `enrollment_submissions`, `notes`, `notifications`, `notification_reads`, `notification_clears`, `group_history`, `student_history`, `error_logs`, `system_settings`, `user_settings`, `media_topics`, `media_files`.

Schema dump is maintained at `docs/db-schema-current.sql` (generated by `npm run db:schema:dump`).

---

## Authentication & Authorization

- **Admin web app:** Cookie-based sessions (`session_id` cookie). Only users with `role = 'admin'` can log in. Middleware checks the cookie and redirects unauthenticated requests to `/login`.
- **Teachers:** Interact via Telegram Mini App / Telegram bot only. They do **not** use the web admin login.
- **Student portal:** Separate PIN-based authentication (`student_session` cookie). Isolated DB role grants restrict student queries to their own data.
- **Service endpoints:** Some API routes require secrets (`CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `MEDIA_BOT_SECRET`).

### Middleware (`src/middleware.ts`)

1. **Admin auth:** Checks `session_id` on protected routes; redirects to `/login` if missing/invalid.
2. **Student subdomain routing:** Detects `students.*` host, checks `student_session`, rewrites paths from `/<path>` → `/s/<path>`.
3. **CSRF protection:** Validates `Origin` header matches `Host` for mutation methods (`POST/PUT/PATCH/DELETE`) on `/api/*`.
4. **Legacy redirects:** `/telegram/lesson/[id]` → `/teacher-app/lesson/[id]` with cache-busting.
5. **Security headers:** Strict CSP, `X-Frame-Options: DENY`, etc.

**Public route whitelist:** `/login`, `/api/auth/*`, `/api/telegram/*`, `/teacher-app`, `/api/teacher-app`, `/tg-app`, `/admin-app`, `/api/admin-app`, `/enroll`, `/api/enroll`, `/api/lesson-media`, `/api/internal`.

**Matcher:** `/((?!_next/static|_next/image|favicon.ico).*)` — runs on all routes except static assets.

---

## API Route Conventions

All API routes follow this pattern:

```ts
import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';

export const dynamic = 'force-dynamic'; // Required for DB-backed routes

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  // ... business logic
}
```

Response helpers from `api-utils.ts`:
- `unauthorized()` — 401
- `forbidden()` — 403
- `badRequest(msg)` — 400
- `notFound(msg)` — 404

---

## Modal System

Each entity type (Groups, Students, Courses, Teachers, Lessons, Camps) has a **Context/Provider/Manager/Wrapper** set of files:

- `*ModalsContext.tsx` — Stores modal open state and entity IDs.
- `*ModalsProvider.tsx` — Wraps children with the context.
- `*ModalsManager.tsx` — Renders the actual modal components.
- `*ModalsWrapper.tsx` — Convenience component that includes both Provider and Manager.

Modals use `DraggableModal.tsx`, which supports dragging and persists position/size to `localStorage`.

---

## i18n

- **Language:** Ukrainian only.
- **Translations:** `src/i18n/uk.ts` — dot-notation keys (e.g., `nav.dashboard`, `actions.save`).
- **Helpers:** `src/i18n/t.ts` exports `t(key)`; `src/i18n/pluralUk.ts` exports `tPlural(key, count)` for Ukrainian plural forms.
- **Usage:** `import { t } from '@/i18n/t';` then `t('pages.groupDetails')`.

---

## Lesson Scheduling & Timezones

- Lessons are stored in **UTC**.
- Timezone conversions use `date-fns-tz` (`fromZonedTime` / `toZonedTime`).
- Default timezone: `Europe/Kyiv`.
- `weekly_day` in the database uses **1–7** (Mon–Sun); JavaScript `Date.getDay()` uses **0–6** (Sun–Sat). Conversion: `weekly_day === 7 ? 0 : weekly_day`.

### Rescheduling

- `PATCH /api/lessons/[id]/reschedule` moves a lesson to a new date/time.
- The original date is saved in `lessons.original_date` so future lesson generation skips that slot (generation checks both `lesson_date` and `original_date`).
- Rescheduled lessons show a purple "Перенесено з..." badge on the schedule page and in the lesson modal.

---

## Telegram Integration

- **Bot logic:** `src/lib/telegram.ts`
- **Webhooks:** `src/app/api/telegram/webhook.ts`, `src/app/api/telegram/callback.ts`
- **Teacher flows:** Teachers receive lesson reminders and can update attendance/topics via Telegram callbacks.
- **Media webhooks:** `src/app/api/telegram/media-webhook.ts` handles file uploads from Telegram to Google Drive.
- **Security:** Telegram callbacks now require `TELEGRAM_WEBHOOK_SECRET`.

---

## Upload Service (`upload-service/`)

A standalone Node.js microservice (Fastify 4 + TypeScript) that handles large lesson media file uploads and streams them to **Google Drive**, bypassing Vercel's payload limits.

### Endpoints
- `POST /upload/lesson-media` — Verifies JWT upload token, parses multipart form, streams file to Google Drive, then calls CRM internal API to finalize.
- `GET /health` — Healthcheck.

### Request flow
1. Browser / Telegram sends multipart request with JWT token, `lessonId`, and file.
2. Upload Service verifies JWT, calls CRM `/api/internal/lessons/:id/media-context`.
3. Creates nested Google Drive folder: `/Фото занять/<Course>/<Group>/<DD.MM.YY Topic>`.
4. Streams file upload via `PassThrough`.
5. Calls CRM `/api/internal/lessons/:id/media-finalize` with photo metadata.

### Env vars (upload service)
- `UPLOAD_SERVICE_PORT` (default `3000`)
- `UPLOAD_SERVICE_JWT_SECRET`
- `UPLOAD_SERVICE_INTERNAL_SECRET`
- `UPLOAD_SERVICE_CRM_BASE_URL`
- `UPLOAD_SERVICE_ALLOWED_ORIGINS`
- `UPLOAD_SERVICE_MAX_UPLOAD_BYTES` (default `536870912` = 512 MB)
- Google OAuth2 credentials: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_LESSON_PHOTOS_ROOT_NAME` (default `Фото занять`)

---

## Build, Dev & Test Commands

```bash
# Development
npm run dev                 # Start Next.js dev server on localhost:3000

# Production build
npm run build               # Build for production
npm run start               # Start production server
npm run prod                # Build + run scripts/start-prod.js

# Linting
npm run lint                # Run ESLint (Next.js built-in config)

# Testing
npm test                    # Run Jest tests
```

### Database commands (Neon PostgreSQL)

```bash
npm run db:migrate:neon     # Run core migrations (create tables + indexes)
npm run db:seed:neon        # Seed with test admin user
npm run db:schema:dump      # Dump schema to docs/db-schema-current.sql
npm run db:backup:data      # JSON export + Telegram notification
```

### One-off migration commands

The `package.json` contains many one-off migration scripts. Examples:
- `npm run db:add-lesson-original-date`
- `npm run db:add-notes`
- `npm run db:add-camps`
- `npm run db:add-student-portal`
- `npm run db:add-enrollment`
- `npm run db:setup-student-role`

These are idempotent Node.js scripts in `scripts/` that add columns/tables. They can be run multiple times safely.

### Legacy SQLite commands

```bash
npm run legacy:db:reset
npm run legacy:db:seed
npm run legacy:db:backfill-public-ids
```

These operate on the old SQLite database (`data/school.db`) and are kept for historical reference.

---

## Environment Variables

Create `.env.local` from `.env.local.example`.

### Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT tokens (auth, upload tokens) |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g., `https://example.com`) |
| `NEXTAUTH_URL` | Same as above (legacy naming) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_WEBHOOK_SECRET` | Secret for Telegram webhook validation |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Optional / Feature-specific

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Secret for cron-protected endpoints |
| `OPENWEATHERMAP_API_KEY` | Weather widget integration |
| `MEDIA_BOT_TOKEN` | Telegram media bot token |
| `MEDIA_BOT_SECRET` | Secret for media bot webhooks |
| `TELEGRAM_SCHOOL_GROUP_ID` | Telegram group chat ID for school notifications |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Root folder for Google Drive integrations |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Google OAuth refresh token |

### Upload Service env vars

Defined in `upload-service/.env.example`:
- `UPLOAD_SERVICE_PORT`
- `UPLOAD_SERVICE_JWT_SECRET`
- `UPLOAD_SERVICE_INTERNAL_SECRET`
- `UPLOAD_SERVICE_CRM_BASE_URL`
- `UPLOAD_SERVICE_ALLOWED_ORIGINS`
- `UPLOAD_SERVICE_MAX_UPLOAD_BYTES`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_LESSON_PHOTOS_ROOT_NAME`

---

## Testing Strategy

- **Framework:** Jest with `ts-jest` preset (`jest.config.js`).
- **Environment:** Node.js.
- **Test roots:** `src/` and `tests/`.
- **Test match:** `**/*.test.ts`.
- **Module alias:** `@/*` → `src/$1`.
- **Coverage:** Collected from `src/**/*.ts`, excluding `src/app/**/*.ts`.

### Test organization (`tests/`)

| File | Domain |
|---|---|
| `assistant-tools.test.ts` | AI assistant SQL query tools |
| `assistant-quick-replies.test.ts` | Quick-reply matching |
| `assistant-guardrails.test.ts` | Off-topic blocking logic |
| `assistant-provider-failover.test.ts` | API key rotation, rate-limit cooldowns |
| `assistant-date-utils.test.ts` | Date normalization helpers |
| `assistant-tool-result-fallback.test.ts` | Tool execution fallbacks |
| `lessons.test.ts` | Lesson generation logic |
| `student-status.test.ts` | Study status computation |
| `env.test.ts` | Runtime env validation |
| `mocks/server-only.ts` | Stub for Next.js `server-only` package |

### Testing conventions

- Mock the database layer with `jest.mock('@/db')` where appropriate.
- Use fake timers (`jest.useFakeTimers()`) for date-sensitive tests.
- Assert parameterized query shapes when testing DB-access functions.

---

## Security Considerations

### Content Security Policy

A strict CSP is applied globally via `next.config.js` headers:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev)
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob: https://res.cloudinary.com https://drive.google.com https://lh3.googleusercontent.com https://api.dicebear.com`
- `media-src 'self' blob: https://drive.google.com https://lh3.googleusercontent.com`
- `frame-src https://drive.google.com`
- `connect-src 'self' https://*.neon.tech https://www.googleapis.com https://*.up.railway.app`
- `font-src 'self' data:`

### CSRF Protection

Middleware validates that the `Origin` header matches `Host` for all mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`) on `/api/*`.

### Auth Secrets

- `TELEGRAM_WEBHOOK_SECRET` is mandatory for Telegram callbacks.
- `MEDIA_BOT_SECRET` gates media webhook endpoints.
- `CRON_SECRET` protects cron-triggered endpoints.
- `UPLOAD_SERVICE_INTERNAL_SECRET` gates CRM internal callbacks from the upload service.

### Cache Control

`no-store` headers are enforced for `/tg-app`, `/teacher-app`, `/admin-app`, and `/api/notifications/telegram/*` to prevent stale data in Mini Apps and notification flows.

### File Upload Limits

- The main Next.js app handles generic uploads via Cloudinary (`/api/upload`).
- Large lesson media files are offloaded to the standalone `upload-service` (default max 512 MB).

---

## Deployment

Deployed on **Vercel** with `output: 'standalone'`.

### Vercel cron jobs (`vercel.json`)

- `GET /api/notifications/birthdays` — daily at `06:00`.

### Deployment checklist

1. Connect repo to Vercel.
2. Fill all required environment variables.
3. Ensure `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` point to the production domain.
4. Ensure `TELEGRAM_WEBHOOK_SECRET` is set.
5. After first deploy, run:
   ```bash
   npm run db:migrate:neon
   ```
6. Optionally seed:
   ```bash
   npm run db:seed:neon
   ```
7. Post-deploy verification:
   - `/login` loads and admin can sign in.
   - Core admin pages load correctly.
   - Teacher / Telegram scenarios work with production env.
   - Webhooks use correct secrets.
   - Reports, photo uploads, and Cloudinary integration work.

See [`DEPLOY.md`](DEPLOY.md) for full instructions.

---

## Notes for Agents

- **`export const dynamic = 'force-dynamic'`** is required on all API routes that read from the database, to prevent Next.js 14 from caching responses.
- **No Tailwind CSS.** Styling uses plain CSS and CSS variables defined in `DESIGN_SYSTEM.md` and global styles.
- **No CI/CD pipelines** are configured (no `.github/workflows/`, no `.gitlab-ci.yml`). Deployment is manual via Vercel.
- **Do not run `git commit`, `git push`, `git reset`, `git rebase`** unless explicitly asked by the user.
- **This is a Windows development environment** (the repo is on Windows), but all files must be written with **UTF-8 / LF** as specified above.
