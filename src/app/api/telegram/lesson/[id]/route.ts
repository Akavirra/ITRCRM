import { NextRequest, NextResponse } from 'next/server';
import { get, all, run } from '@/db';
import { formatDateTimeKyiv, formatDateKyiv, formatTimeKyiv } from '@/lib/date-utils';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  notes: string | null;
  status: string;
  topic_set_by: number | null;
  topic_set_at: string | null;
  notes_set_by: number | null;
  notes_set_at: string | null;
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Verify Telegram Mini App initData using HMAC-SHA256 (per Telegram docs)
async function verifyTelegramUser(initData: string): Promise<{ id: number; name: string } | null> {
  if (!initData || !TELEGRAM_BOT_TOKEN) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray.map(([key, value]) => `${key}=${value}`).join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    const userJson = params.get('user');
    if (!userJson) return null;

    const telegramUser = JSON.parse(userJson);
    if (!telegramUser?.id) return null;

    const dbUser = await get<{ id: number; name: string }>(
      `SELECT id, name FROM users WHERE telegram_id = $1`,
      [telegramUser.id.toString()]
    );

    return dbUser || null;
  } catch {
    return null;
  }
}

// GET /api/telegram/lesson/[id] - Get lesson for Telegram WebApp
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const initData = request.nextUrl.searchParams.get('initData') || '';
  const telegramUser = await verifyTelegramUser(initData);
  if (!telegramUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawId = params.id;
  let lesson;

  const numericId = parseInt(rawId, 10);
  if (!isNaN(numericId)) {
    lesson = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null; start_time_formatted: string | null; end_time_formatted: string | null }>(
      `SELECT
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time_formatted,
        TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time_formatted,
        l.topic,
        l.notes,
        l.status,
        l.created_by,
        l.teacher_id,
        l.topic_set_by,
        l.topic_set_at,
        l.notes_set_by,
        l.notes_set_at,
        u.name as teacher_name,
        g.title as group_title,
        g.teacher_id as original_teacher_id,
        g.course_id as course_id,
        c.title as course_title,
        CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced,
        CASE
          WHEN l.topic_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
            COALESCE(
              l.telegram_user_info->>'first_name',
              telegram_info_user.name,
              'Telegram User'
            )
          WHEN l.topic_set_by < 0 THEN 'Telegram User'
          ELSE topic_user.name
        END as topic_set_by_name,
        CASE
          WHEN l.notes_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
            COALESCE(
              l.telegram_user_info->>'first_name',
              telegram_info_user.name,
              'Telegram User'
            )
          WHEN l.notes_set_by < 0 THEN 'Telegram User'
          ELSE notes_user.name
        END as notes_set_by_name,
        CASE
          WHEN l.topic_set_by < 0 THEN CAST((-l.topic_set_by) AS TEXT)
          ELSE topic_user.telegram_id
        END as topic_set_by_telegram_id,
        CASE
          WHEN l.notes_set_by < 0 THEN CAST((-l.notes_set_by) AS TEXT)
          ELSE notes_user.telegram_id
        END as notes_set_by_telegram_id
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
      LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
      LEFT JOIN users telegram_info_user ON l.telegram_user_info IS NOT NULL
        AND l.telegram_user_info->>'user_id' IS NOT NULL
        AND l.telegram_user_info->>'user_id' = telegram_info_user.telegram_id
      WHERE l.id = $1`,
      [numericId]
    );
  }

  if (!lesson && rawId.includes('LSN-')) {
    lesson = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null; start_time_formatted: string | null; end_time_formatted: string | null }>(
      `SELECT
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time_formatted,
        TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time_formatted,
        l.topic,
        l.notes,
        l.status,
        l.created_by,
        l.teacher_id,
        l.topic_set_by,
        l.topic_set_at,
        l.notes_set_by,
        l.notes_set_at,
        u.name as teacher_name,
        g.title as group_title,
        g.teacher_id as original_teacher_id,
        g.course_id as course_id,
        c.title as course_title,
        CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced,
        CASE
          WHEN l.topic_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
            COALESCE(
              l.telegram_user_info->>'first_name',
              telegram_info_user.name,
              'Telegram User'
            )
          WHEN l.topic_set_by < 0 THEN 'Telegram User'
          ELSE topic_user.name
        END as topic_set_by_name,
        CASE
          WHEN l.notes_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
            COALESCE(
              l.telegram_user_info->>'first_name',
              telegram_info_user.name,
              'Telegram User'
            )
          WHEN l.notes_set_by < 0 THEN 'Telegram User'
          ELSE notes_user.name
        END as notes_set_by_name,
        CASE
          WHEN l.topic_set_by < 0 THEN CAST((-l.topic_set_by) AS TEXT)
          ELSE topic_user.telegram_id
        END as topic_set_by_telegram_id,
        CASE
          WHEN l.notes_set_by < 0 THEN CAST((-l.notes_set_by) AS TEXT)
          ELSE notes_user.telegram_id
        END as notes_set_by_telegram_id
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
      LEFT JOIN users telegram_info_user ON l.telegram_user_info IS NOT NULL
        AND l.telegram_user_info->>'user_id' IS NOT NULL
        AND l.telegram_user_info->>'user_id' = telegram_info_user.telegram_id
      WHERE l.public_id = $1`,
      [rawId]
    );
  }

  if (!lesson) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }

  const transformedLesson = {
    id: lesson.id,
    groupId: lesson.group_id,
    groupTitle: lesson.group_title,
    courseTitle: lesson.course_title,
    courseId: lesson.course_id,
    teacherId: lesson.teacher_id || lesson.original_teacher_id || null,
    teacherName: lesson.teacher_name || (lesson.original_teacher_id ? 'Викладач групи' : 'Немає викладача'),
    originalTeacherId: lesson.original_teacher_id || null,
    isReplaced: lesson.is_replaced,
    startTime: lesson.start_time_formatted || formatTimeKyiv(lesson.start_datetime),
    endTime: lesson.end_time_formatted || formatTimeKyiv(lesson.end_datetime),
    lessonDate: formatDateKyiv(lesson.lesson_date),
    status: lesson.status,
    topic: lesson.topic,
    notes: lesson.notes,
    topicSetBy: lesson.topic_set_by_name,
    topicSetAt: formatDateTimeKyiv(lesson.topic_set_at),
    topicSetByTelegramId: lesson.topic_set_by_telegram_id || null,
    notesSetBy: lesson.notes_set_by_name,
    notesSetAt: formatDateTimeKyiv(lesson.notes_set_at),
    notesSetByTelegramId: lesson.notes_set_by_telegram_id || null,
  };

  return NextResponse.json({ lesson: transformedLesson });
}

// PATCH /api/telegram/lesson/[id] - Update lesson from Telegram WebApp
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const initData = request.headers.get('x-telegram-init-data') || '';
  const telegramUser = await verifyTelegramUser(initData);
  if (!telegramUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawId = params.id;
  let lesson: Lesson | null = null;

  const numericId = parseInt(rawId, 10);
  if (!isNaN(numericId)) {
    lesson = (await get<Lesson>(
      `SELECT * FROM lessons WHERE id = $1`,
      [numericId]
    )) || null;
  }

  if (!lesson && rawId.includes('LSN-')) {
    lesson = (await get<Lesson>(
      `SELECT * FROM lessons WHERE public_id = $1`,
      [rawId]
    )) || null;
  }

  if (!lesson) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { topic, notes } = body;

    const updates: string[] = ['updated_at = NOW()'];
    const queryParams: (string | number | null)[] = [];

    if (topic !== undefined) {
      const topicValue = topic === '' ? null : topic;
      updates.push(`topic = $${queryParams.length + 1}::text`);
      queryParams.push(topicValue);
      updates.push(`topic_set_by = $${queryParams.length + 1}`);
      queryParams.push(telegramUser.id);
      updates.push(`topic_set_at = NOW()`);
    }

    if (notes !== undefined) {
      const notesValue = notes === '' ? null : notes;
      updates.push(`notes = $${queryParams.length + 1}::text`);
      queryParams.push(notesValue);
      updates.push(`notes_set_by = $${queryParams.length + 1}`);
      queryParams.push(telegramUser.id);
      updates.push(`notes_set_at = NOW()`);
    }

    queryParams.push(lesson.id);

    const sql = `UPDATE lessons SET ${updates.join(', ')} WHERE id = $${queryParams.length}`;
    await run(sql, queryParams);

    const updatedLessonRaw = await get<Lesson & { topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null; telegram_user_info: unknown; start_time_formatted: string | null; end_time_formatted: string | null }>(
      `SELECT
        l.*,
        TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time_formatted,
        TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time_formatted,
        CASE
          WHEN l.topic_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
            COALESCE(
              l.telegram_user_info->>'first_name',
              telegram_info_user.name,
              'Telegram User'
            )
          WHEN l.topic_set_by < 0 THEN 'Telegram User'
          ELSE topic_user.name
        END as topic_set_by_name,
        CASE
          WHEN l.notes_set_by IS NULL AND l.telegram_user_info IS NOT NULL THEN
            COALESCE(
              l.telegram_user_info->>'first_name',
              telegram_info_user.name,
              'Telegram User'
            )
          WHEN l.notes_set_by < 0 THEN 'Telegram User'
          ELSE notes_user.name
        END as notes_set_by_name,
        CASE
          WHEN l.topic_set_by < 0 THEN CAST((-l.topic_set_by) AS TEXT)
          ELSE topic_user.telegram_id
        END as topic_set_by_telegram_id,
        CASE
          WHEN l.notes_set_by < 0 THEN CAST((-l.notes_set_by) AS TEXT)
          ELSE notes_user.telegram_id
        END as notes_set_by_telegram_id
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
      LEFT JOIN users telegram_info_user ON l.telegram_user_info IS NOT NULL
        AND l.telegram_user_info->>'user_id' IS NOT NULL
        AND l.telegram_user_info->>'user_id' = telegram_info_user.telegram_id
      WHERE l.id = $1`,
      [lesson.id]
    );

    const updatedLesson = updatedLessonRaw ? {
      id: updatedLessonRaw.id,
      groupId: updatedLessonRaw.group_id,
      lessonDate: formatDateKyiv(updatedLessonRaw.lesson_date),
      startTime: updatedLessonRaw.start_time_formatted || formatTimeKyiv(updatedLessonRaw.start_datetime),
      endTime: updatedLessonRaw.end_time_formatted || formatTimeKyiv(updatedLessonRaw.end_datetime),
      status: updatedLessonRaw.status,
      topic: updatedLessonRaw.topic,
      notes: updatedLessonRaw.notes,
      topicSetBy: updatedLessonRaw.topic_set_by_name,
      topicSetAt: formatDateTimeKyiv(updatedLessonRaw.topic_set_at),
      topicSetByTelegramId: updatedLessonRaw.topic_set_by_telegram_id,
      notesSetBy: updatedLessonRaw.notes_set_by_name,
      notesSetAt: formatDateTimeKyiv(updatedLessonRaw.notes_set_at),
      notesSetByTelegramId: updatedLessonRaw.notes_set_by_telegram_id,
    } : null;

    return NextResponse.json({
      message: 'Заняття оновлено',
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити заняття' }, { status: 500 });
  }
}
