import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/db/neon';
import crypto from 'crypto';
import { getLessonPhotoPayload, registerLessonDriveFile } from '@/lib/lesson-photos';
import { isSupportedLessonMediaFile, resolveLessonMediaMimeType } from '@/lib/lesson-media';
import { createUploadServiceToken, getUploadServiceUrl } from '@/lib/upload-service';
import { getTodayKyivDateString, normalizeDateOnly } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAX_FILE_SIZE = 1024 * 1024 * 1024;

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
    if (!hash) return { valid: false };

    params.delete('hash');
    const paramsArray = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray.map(([key, value]) => `${key}=${value}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculatedHash !== hash) return { valid: false };

    const userJson = params.get('user');
    if (!userJson) return { valid: false };

    const user = JSON.parse(userJson);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return { valid: false };

    return { valid: true, telegramId: user.id.toString() };
  } catch (error) {
    console.error('Error verifying initData:', error);
    return { valid: false };
  }
}

async function getTeacherLessonAccess(request: NextRequest, lessonId: number) {
  const initData = request.headers.get('X-Telegram-Init-Data');
  if (!initData) {
    return { teacher: null, lesson: null, telegramId: null, response: NextResponse.json({ error: 'X-Telegram-Init-Data РѕР±РѕРІКјСЏР·РєРѕРІРёР№' }, { status: 401 }) };
  }

  const verification = verifyInitData(initData);
  if (!verification.valid || !verification.telegramId) {
    return { teacher: null, lesson: null, telegramId: null, response: NextResponse.json({ error: 'РќРµРІС–СЂРЅРёР№ initData' }, { status: 401 }) };
  }

  const teacher = await queryOne(
    `SELECT id, name FROM users WHERE telegram_id = $1 AND is_active = TRUE LIMIT 1`,
    [verification.telegramId]
  ) as { id: number; name: string } | null;

  if (!teacher) {
    return { teacher: null, lesson: null, telegramId: null, response: NextResponse.json({ error: 'Р’РёРєР»Р°РґР°С‡Р° РЅРµ Р·РЅР°Р№РґРµРЅРѕ' }, { status: 401 }) };
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
    return { teacher, lesson: null, telegramId: verification.telegramId, response: NextResponse.json({ error: 'Р—Р°РЅСЏС‚С‚СЏ РЅРµ Р·РЅР°Р№РґРµРЅРѕ Р°Р±Рѕ РґРѕСЃС‚СѓРї Р·Р°Р±РѕСЂРѕРЅРµРЅРѕ' }, { status: 404 }) };
  }

  if (lesson.group_id === null) {
    return { teacher, lesson, telegramId: verification.telegramId, response: NextResponse.json({ error: 'РњРµРґС–Р° РґРѕСЃС‚СѓРїРЅС– Р»РёС€Рµ РґР»СЏ РіСЂСѓРїРѕРІРёС… Р·Р°РЅСЏС‚СЊ' }, { status: 400 }) };
  }

  return { teacher, lesson, telegramId: verification.telegramId, response: null };
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

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === 'start') {
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
    const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : null;
    const fileLike = { name: fileName, type: mimeType } as File;

    if (!fileName || !mimeType || !isSupportedLessonMediaFile(fileLike)) {
      return NextResponse.json({ error: 'РќРµРїС–РґС‚СЂРёРјСѓРІР°РЅРёР№ С‚РёРї РјРµРґС–Р°С„Р°Р№Р»Сѓ' }, { status: 400 });
    }

    if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Р¤Р°Р№Р» РїРµСЂРµРІРёС‰СѓС” 1GB' }, { status: 400 });
    }

    const uploadToken = createUploadServiceToken({
      lessonId,
      userId: access.teacher!.id,
      userName: access.teacher!.name,
      via: 'telegram',
      telegramId: access.telegramId ?? null,
    });
    if (false) {
      return NextResponse.json({ error: 'РњРµРґС–Р° РґРѕСЃС‚СѓРїРЅС– Р»РёС€Рµ РґР»СЏ РіСЂСѓРїРѕРІРёС… Р·Р°РЅСЏС‚СЊ' }, { status: 400 });
    }

    return NextResponse.json({
      uploadUrl: `${getUploadServiceUrl()}/upload/lesson-media`,
      uploadToken,
      fileName,
      mimeType: resolveLessonMediaMimeType(fileLike),
    });
  }

  if (action === 'finalize') {
    const driveFileId = typeof body?.driveFileId === 'string' ? body.driveFileId : '';
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
    const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : 0;

    if (!driveFileId || !fileName || !mimeType || !fileSize) {
      return NextResponse.json({ error: 'РќРµРґРѕСЃС‚Р°С‚РЅСЊРѕ РґР°РЅРёС… РґР»СЏ Р·Р°РІРµСЂС€РµРЅРЅСЏ Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ' }, { status: 400 });
    }

    await registerLessonDriveFile({
      lessonId,
      driveFileId,
      fileName,
      mimeType,
      fileSize,
      uploadedBy: access.teacher!.id,
      uploadedByName: access.teacher!.name,
      uploadedVia: 'telegram',
      uploadedByTelegramId: access.telegramId ?? null,
    });

    const payload = await getLessonPhotoPayload(lessonId);
    return NextResponse.json({
      photoFolder: payload.photoFolder,
      photos: payload.photos,
      canManagePhotos: isTeacherLessonEditable(access.lesson?.lesson_date),
    });
  }

  return NextResponse.json({ error: 'РќРµРІС–РґРѕРјР° РґС–СЏ' }, { status: 400 });
}

