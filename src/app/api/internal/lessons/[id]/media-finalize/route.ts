import { NextRequest, NextResponse } from 'next/server';
import { getLessonPhotoPayload, registerLessonDriveFile } from '@/lib/lesson-photos';
import { assertInternalApiSecret } from '@/lib/upload-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!assertInternalApiSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const lessonId = parseInt(params.id, 10);
  if (Number.isNaN(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const driveFileId = typeof body?.driveFileId === 'string' ? body.driveFileId : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
  const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : 0;
  const uploadedBy = typeof body?.uploadedBy === 'number' ? body.uploadedBy : null;
  const uploadedByName = typeof body?.uploadedByName === 'string' ? body.uploadedByName : null;
  const uploadedVia = body?.uploadedVia === 'telegram' ? 'telegram' : 'admin';
  const uploadedByTelegramId = typeof body?.uploadedByTelegramId === 'string' ? body.uploadedByTelegramId : null;

  if (!driveFileId || !fileName || !mimeType || !fileSize) {
    return NextResponse.json({ error: 'Missing upload finalize payload' }, { status: 400 });
  }

  await registerLessonDriveFile({
    lessonId,
    driveFileId,
    fileName,
    mimeType,
    fileSize,
    uploadedBy,
    uploadedByName,
    uploadedVia,
    uploadedByTelegramId,
  });

  const payload = await getLessonPhotoPayload(lessonId);
  return NextResponse.json({
    photoFolder: payload.photoFolder,
    photos: payload.photos,
    canManagePhotos: true,
  });
}
