/**
 * PATCH/DELETE /api/teacher-app/lessons/[id]/shortcuts/[shortcutId]
 *
 * Викладач (через Telegram WebApp) редагує/видаляє свій ярлик.
 * На відміну від адмінського equivalent — тут перевірка доступу до заняття
 * через group_teacher_assignments / lesson_teacher_replacements.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryOne } from '@/db/neon';
import {
  deleteLessonShortcut,
  getLessonShortcut,
  updateLessonShortcut,
  validateShortcutInput,
  ShortcutValidationError,
} from '@/lib/lesson-shortcuts';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function verifyInitData(initData: string): { valid: boolean; telegramId?: string } {
  if (!TELEGRAM_BOT_TOKEN) return { valid: false };
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    params.delete('hash');

    const arr = Array.from(params.entries());
    arr.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = arr.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();
    const calc = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    if (calc !== hash) return { valid: false };

    const userJson = params.get('user');
    if (!userJson) return { valid: false };
    const user = JSON.parse(userJson);

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return { valid: false };

    return { valid: true, telegramId: user.id.toString() };
  } catch {
    return { valid: false };
  }
}

async function authorize(
  request: NextRequest,
  lessonId: number,
): Promise<{ teacher: { id: number; name: string }; telegramId: string } | NextResponse> {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) {
    return NextResponse.json(
      { error: 'Заголовок X-Telegram-Init-Data обовʼязковий' },
      { status: 401 },
    );
  }
  const v = verifyInitData(initData);
  if (!v.valid || !v.telegramId) {
    return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });
  }

  const teacher = (await queryOne(
    `SELECT id, name FROM users WHERE telegram_id = $1 AND is_active = TRUE LIMIT 1`,
    [v.telegramId],
  )) as { id: number; name: string } | null;
  if (!teacher) {
    return NextResponse.json({ error: 'Викладача не знайдено' }, { status: 401 });
  }

  const lesson = await queryOne(
    `SELECT l.id
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     WHERE l.id = $1
       AND (
         g.teacher_id = $2
         OR ltr.replacement_teacher_id = $2
         OR (l.group_id IS NULL AND l.teacher_id = $2)
       )
     LIMIT 1`,
    [lessonId, teacher.id],
  );
  if (!lesson) {
    return NextResponse.json(
      { error: 'Заняття не знайдено або доступ заборонено' },
      { status: 404 },
    );
  }

  return { teacher, telegramId: v.telegramId };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; shortcutId: string } },
) {
  const lessonId = parseInt(params.id, 10);
  const shortcutId = parseInt(params.shortcutId, 10);
  if (Number.isNaN(lessonId) || Number.isNaN(shortcutId)) {
    return NextResponse.json({ error: 'Невірний ID' }, { status: 400 });
  }

  const access = await authorize(request, lessonId);
  if (access instanceof NextResponse) return access;

  const existing = await getLessonShortcut(shortcutId);
  if (!existing || existing.lesson_id !== lessonId) {
    return NextResponse.json({ error: 'Ярлик не знайдено' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  let input;
  try {
    input = validateShortcutInput(body);
  } catch (e) {
    if (e instanceof ShortcutValidationError) {
      return NextResponse.json({ error: e.message, field: e.field }, { status: 400 });
    }
    throw e;
  }

  const updated = await updateLessonShortcut(shortcutId, input);
  if (!updated) {
    return NextResponse.json({ error: 'Ярлик не знайдено' }, { status: 404 });
  }
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; shortcutId: string } },
) {
  const lessonId = parseInt(params.id, 10);
  const shortcutId = parseInt(params.shortcutId, 10);
  if (Number.isNaN(lessonId) || Number.isNaN(shortcutId)) {
    return NextResponse.json({ error: 'Невірний ID' }, { status: 400 });
  }

  const access = await authorize(request, lessonId);
  if (access instanceof NextResponse) return access;

  const existing = await getLessonShortcut(shortcutId);
  if (!existing || existing.lesson_id !== lessonId) {
    return NextResponse.json({ error: 'Ярлик не знайдено' }, { status: 404 });
  }

  const ok = await deleteLessonShortcut(shortcutId);
  if (!ok) {
    return NextResponse.json({ error: 'Ярлик не знайдено' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
