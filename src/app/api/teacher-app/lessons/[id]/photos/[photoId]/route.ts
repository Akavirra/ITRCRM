import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/db/neon';
import crypto from 'crypto';
import { deleteLessonPhoto, getLessonPhotoPayload } from '@/lib/lesson-photos';
import { getTodayKyivDateString, normalizeDateOnly } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function isTeacherLessonEditable(lessonDate: string | Date | null | undefined): boolean {
  return normalizeDateOnly(lessonDate) === getTodayKyivDateString();
}

function verifyInitData(initData: string): { valid: boolean; telegramId?: string } {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return { valid: false };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false };
    }

    params.delete('hash');

    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userJson = params.get('user');
    if (!userJson) {
      return { valid: false };
    }

    const user = JSON.parse(userJson);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false };
    }

    return { valid: true, telegramId: user.id.toString() };
  } catch (error) {
    console.error('Error verifying initData:', error);
    return { valid: false };
  }
}

async function getTeacherLessonAccess(request: NextRequest, lessonId: number) {
  const initData = request.headers.get('X-Telegram-Init-Data');

  if (!initData) {
    return {
      teacher: null,
      lesson: null,
      response: NextResponse.json({ error: 'Заголовок X-Telegram-Init-Data обовʼязковий' }, { status: 401 }),
    };
  }

  const verification = verifyInitData(initData);

  if (!verification.valid || !verification.telegramId) {
    return {
      teacher: null,
      lesson: null,
      response: NextResponse.json({ error: 'Невірний initData' }, { status: 401 }),
    };
  }

  const teacher = await queryOne(
    `SELECT id, name FROM users WHERE telegram_id = $1 AND role = 'teacher' AND is_active = TRUE LIMIT 1`,
    [verification.telegramId]
  ) as { id: number; name: string } | null;

  if (!teacher) {
    return {
      teacher: null,
      lesson: null,
      response: NextResponse.json({ error: 'Викладача не знайдено' }, { status: 401 }),
    };
  }

  const lesson = await queryOne(
    `SELECT l.id, l.group_id, l.lesson_date
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
     WHERE l.id = $1
       AND (
         g.teacher_id = $2
         OR ltr.replacement_teacher_id = $2
         OR (l.group_id IS NULL AND l.teacher_id = $2)
       )`,
    [lessonId, teacher.id]
  ) as { id: number; group_id: number | null; lesson_date: string | null } | null;

  if (!lesson) {
    return {
      teacher,
      lesson: null,
      telegramId: verification.telegramId,
      response: NextResponse.json({ error: 'Заняття не знайдено або доступ заборонено' }, { status: 404 }),
    };
  }

  if (lesson.group_id === null) {
    return {
      teacher,
      lesson,
      telegramId: verification.telegramId,
      response: NextResponse.json({ error: 'Медіа доступні лише для групових занять' }, { status: 400 }),
    };
  }

  return {
    teacher,
    lesson,
    telegramId: verification.telegramId,
    response: null,
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const lessonId = parseInt(params.id, 10);
  const photoId = parseInt(params.photoId, 10);

  if (Number.isNaN(lessonId) || Number.isNaN(photoId)) {
    return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
  }

  const access = await getTeacherLessonAccess(request, lessonId);
  if (access.response) {
    return access.response;
  }

  if (!isTeacherLessonEditable(access.lesson?.lesson_date)) {
    return NextResponse.json({ error: 'Викладач може змінювати медіа лише для сьогоднішніх занять.' }, { status: 403 });
  }

  try {
    const deleted = await deleteLessonPhoto(photoId, lessonId, {
      id: access.teacher!.id,
      name: access.teacher!.name,
      via: 'telegram',
      telegramId: access.telegramId ?? null,
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Медіа не знайдено' }, { status: 404 });
    }

    const payload = await getLessonPhotoPayload(lessonId);

    return NextResponse.json({
      success: true,
      photoFolder: payload.photoFolder,
      photos: payload.photos,
      canManagePhotos: isTeacherLessonEditable(access.lesson?.lesson_date),
    });
  } catch (error) {
    console.error('Teacher lesson photo delete error:', error);
    return NextResponse.json({ error: 'Не вдалося видалити медіа заняття' }, { status: 500 });
  }
}
