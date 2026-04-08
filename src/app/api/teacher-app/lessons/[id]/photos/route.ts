import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/db/neon';
import crypto from 'crypto';
import { addLessonPhotoRecord, getLessonPhotoPayload } from '@/lib/lesson-photos';
import { isSupportedLessonMediaFile, resolveLessonMediaMimeType } from '@/lib/lesson-media';
import { getTodayKyivDateString, normalizeDateOnly } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

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
      response: NextResponse.json({ error: 'Р—Р°РіРѕР»РѕРІРѕРє X-Telegram-Init-Data РѕР±РѕРІКјСЏР·РєРѕРІРёР№' }, { status: 401 }),
    };
  }

  const verification = verifyInitData(initData);

  if (!verification.valid || !verification.telegramId) {
    return {
      teacher: null,
      lesson: null,
      response: NextResponse.json({ error: 'РќРµРІС–СЂРЅРёР№ initData' }, { status: 401 }),
    };
  }

  const teacher = await queryOne(
    `SELECT id, name FROM users WHERE telegram_id = $1 AND is_active = TRUE LIMIT 1`,
    [verification.telegramId]
  ) as { id: number; name: string } | null;

  if (!teacher) {
    return {
      teacher: null,
      lesson: null,
      response: NextResponse.json({ error: 'Р’РёРєР»Р°РґР°С‡Р° РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 401 }),
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
      response: NextResponse.json({ error: 'Р—Р°РЅСЏС‚С‚СЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ Р°Р±Рѕ РґРѕСЃС‚СѓРї Р·Р°Р±РѕСЂРѕРЅРµРЅРѕ' }, { status: 404 }),
    };
  }

  if (lesson.group_id === null) {
    return {
      teacher,
      lesson,
      response: NextResponse.json({ error: 'Р¤РѕС‚Рѕ РґРѕСЃС‚СѓРїРЅС– Р»РёС€Рµ РґР»СЏ РіСЂСѓРїРѕРІРёС… Р·Р°РЅСЏС‚СЊ' }, { status: 400 }),
    };
  }

  return {
    teacher,
    lesson,
    telegramId: verification.telegramId,
    response: null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lessonId = parseInt(params.id, 10);

  if (Number.isNaN(lessonId)) {
    return NextResponse.json({ error: 'РќРµРІС–СЂРЅРёР№ ID Р·Р°РЅСЏС‚С‚СЏ' }, { status: 400 });
  }

  const access = await getTeacherLessonAccess(request, lessonId);
  if (access.response) {
    return access.response;
  }

  let payload;
  try {
    payload = await getLessonPhotoPayload(lessonId);
  } catch (error) {
    console.error('Failed to load lesson photos payload:', error);
    return NextResponse.json({ error: 'РќРµ РІРґР°Р»РѕСЃСЏ РѕС‚СЂРёРјР°С‚Рё С„РѕС‚Рѕ Р·Р°РЅСЏС‚С‚СЏ' }, { status: 500 });
  }

  return NextResponse.json({
    photoFolder: payload.photoFolder,
    photos: payload.photos,
    canManagePhotos: isTeacherLessonEditable(access.lesson?.lesson_date),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lessonId = parseInt(params.id, 10);

  if (Number.isNaN(lessonId)) {
    return NextResponse.json({ error: 'РќРµРІС–СЂРЅРёР№ ID Р·Р°РЅСЏС‚С‚СЏ' }, { status: 400 });
  }

  const access = await getTeacherLessonAccess(request, lessonId);
  if (access.response) {
    return access.response;
  }

  if (!isTeacherLessonEditable(access.lesson?.lesson_date)) {
    return NextResponse.json({ error: 'Р’РёРєР»Р°РґР°С‡ РјРѕР¶Рµ Р·РјС–РЅСЋРІР°С‚Рё РјРµРґС–Р° Р»РёС€Рµ РґР»СЏ СЃСЊРѕРіРѕРґРЅС–С€РЅС–С… Р·Р°РЅСЏС‚СЊ.' }, { status: 403 });
  }

  const formData = await request.formData();
  const files = [
    ...formData.getAll('files'),
    ...formData.getAll('file'),
  ].filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'Р¤Р°Р№Р»Рё РЅРµ РІРёР±СЂР°РЅРѕ' }, { status: 400 });
  }

  for (const file of files) {
    if (!isSupportedLessonMediaFile(file)) {
      return NextResponse.json({ error: `РќРµРїС–РґС‚СЂРёРјСѓРІР°РЅРёР№ С‚РёРї С„Р°Р№Р»Сѓ: ${file.type}` }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Р¤Р°Р№Р» ${file.name} РїРµСЂРµРІРёС‰СѓС” 15MB` }, { status: 400 });
    }
  }

  try {
    const uploaded = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      uploaded.push(await addLessonPhotoRecord({
        lessonId,
        buffer: Buffer.from(bytes),
        fileName: file.name,
        mimeType: resolveLessonMediaMimeType(file),
        fileSize: file.size,
        uploadedBy: access.teacher!.id,
        uploadedByName: access.teacher!.name,
        uploadedVia: 'telegram',
        uploadedByTelegramId: access.telegramId ?? null,
      }));
    }

    const payload = await getLessonPhotoPayload(lessonId);

    return NextResponse.json({
      uploaded,
      photoFolder: payload.photoFolder,
      photos: payload.photos,
      canManagePhotos: isTeacherLessonEditable(access.lesson?.lesson_date),
    });
  } catch (error) {
    console.error('Teacher lesson photos upload error:', error);
    return NextResponse.json({ error: 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё С„РѕС‚Рѕ Р·Р°РЅСЏС‚С‚СЏ' }, { status: 500 });
  }
}

