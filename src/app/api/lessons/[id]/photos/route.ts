import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { get } from '@/db';
import { addLessonPhotoRecord, getLessonPhotoPayload } from '@/lib/lesson-photos';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/jpg'];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function isSupportedImageFile(file: File): boolean {
  if (file.type && (ALLOWED_MIME_TYPES.includes(file.type) || file.type.startsWith('image/'))) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].some((ext) => lowerName.endsWith(ext));
}

function resolveMimeType(file: File): string {
  if (file.type && file.type.startsWith('image/')) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.heic')) return 'image/heic';
  if (lowerName.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

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
      response: NextResponse.json({ error: 'Фото доступні лише для групових занять' }, { status: 400 }),
    };
  }

  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  if (!hasAccess) {
    return { user, lesson, response: forbidden() };
  }

  return { user, lesson, response: null };
}

export async function GET(
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

  let payload;
  try {
    payload = await getLessonPhotoPayload(lessonId);
  } catch (error) {
    console.error('Failed to load lesson photos payload:', error);
    return NextResponse.json({ error: 'Не вдалося отримати фото заняття' }, { status: 500 });
  }

  return NextResponse.json({
    photoFolder: payload.photoFolder,
    photos: payload.photos,
    canManagePhotos: access.user?.role === 'admin',
  });
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

  const formData = await request.formData();
  const files = [
    ...formData.getAll('files'),
    ...formData.getAll('file'),
  ].filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: 'Файли не вибрано' }, { status: 400 });
  }

  for (const file of files) {
    if (!isSupportedImageFile(file)) {
      return NextResponse.json({ error: `Непідтримуваний тип файлу: ${file.type}` }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `Файл ${file.name} перевищує 15MB` }, { status: 400 });
    }
  }

  const uploadedFiles = [];

  try {
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const uploaded = await addLessonPhotoRecord({
        lessonId,
        buffer: Buffer.from(bytes),
        fileName: file.name,
        mimeType: resolveMimeType(file),
        fileSize: file.size,
        uploadedBy: access.user!.id,
        uploadedByName: access.user!.name,
        uploadedVia: 'admin',
      });
      uploadedFiles.push(uploaded);
    }

    const payload = await getLessonPhotoPayload(lessonId);

    return NextResponse.json({
      uploaded: uploadedFiles,
      photoFolder: payload.photoFolder,
      photos: payload.photos,
      canManagePhotos: true,
    });
  } catch (error) {
    console.error('Lesson photos upload error:', error);
    return NextResponse.json({ error: 'Не вдалося завантажити фото заняття' }, { status: 500 });
  }
}
