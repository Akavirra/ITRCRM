import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { get } from '@/db';
import { getLessonPhotoPayload, registerLessonDriveFile } from '@/lib/lesson-photos';
import { isSupportedLessonMediaFile, resolveLessonMediaMimeType } from '@/lib/lesson-media';
import { createUploadServiceToken, getUploadServiceUrl } from '@/lib/upload-service';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 1024 * 1024 * 1024;

async function getAccessibleLesson(request: NextRequest, lessonId: number) {
  const user = await getAuthUser(request);

  if (!user) {
    return { user: null, lesson: null, response: unauthorized() };
  }

  const lesson = await get<{ id: number; group_id: number | null }>(
    `SELECT id, group_id FROM lessons WHERE id = $1`,
    [lessonId]
  );

  if (!lesson) {
    return {
      user,
      lesson: null,
      response: NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 }),
    };
  }

  if (lesson.group_id === null) {
    return {
      user,
      lesson,
      response: NextResponse.json({ error: 'Медіа доступні лише для групових занять' }, { status: 400 }),
    };
  }

  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  if (!hasAccess) {
    return { user, lesson, response: forbidden() };
  }

  return { user, lesson, response: null };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lessonId = parseInt(params.id, 10);

  if (Number.isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }

  const access = await getAccessibleLesson(request, lessonId);
  if (access.response) {
    return access.response;
  }

  if (access.user?.role !== 'admin') {
    return forbidden();
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === 'start') {
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
    const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : null;
    const fileLike = { name: fileName, type: mimeType } as File;

    if (!fileName || !mimeType || !isSupportedLessonMediaFile(fileLike)) {
      return NextResponse.json({ error: 'Непідтримуваний тип медіафайлу' }, { status: 400 });
    }

    if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Файл перевищує 1GB' }, { status: 400 });
    }

    const uploadToken = createUploadServiceToken({
      lessonId,
      userId: access.user!.id,
      userName: access.user!.name,
      via: 'admin',
    });
    if (false) {
      return NextResponse.json({ error: 'Медіа доступні лише для групових занять' }, { status: 400 });
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
      return NextResponse.json({ error: 'Недостатньо даних для завершення завантаження' }, { status: 400 });
    }

    await registerLessonDriveFile({
      lessonId,
      driveFileId,
      fileName,
      mimeType,
      fileSize,
      uploadedBy: access.user!.id,
      uploadedByName: access.user!.name,
      uploadedVia: 'admin',
    });

    const payload = await getLessonPhotoPayload(lessonId);
    return NextResponse.json({
      photoFolder: payload.photoFolder,
      photos: payload.photos,
      canManagePhotos: true,
    });
  }

  return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
}
