# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## ⚠️ CRITICAL: File encoding

**All files in this repo MUST be read and saved as UTF-8 with LF line endings.**

This repo is Ukrainian-language. In the past, files were silently re-encoded as Windows-1251 (cp1251), producing mojibake like `РќРµРґС–Р»СЏ` (which is `Неділя` double-encoded through UTF-8 → cp1251 → UTF-8). Restoring the file required rewriting hundreds of strings. This happened after Codex sessions — so Codex specifically must not repeat it.

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

## 🎨 Design & UI work

Any time you write, edit, or review UI code (components, pages, modals, animations, CSS, Tailwind), you **must** apply the design-engineering philosophy of Emil Kowalski — that is the bar for UI in this project.

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
