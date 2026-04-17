import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getCourseById, updateCourseFlyerPath, getCourseFlyerPath } from '@/lib/courses';
import { uploadBuffer, deleteImage, getPublicIdFromUrl } from '@/lib/cloudinary';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  invalidCourseId: 'Невірний ID курсу',
  courseNotFound: 'Курс не знайдено',
  noFile: 'Файл не обрано',
  invalidFileType: 'Непідтримуваний тип файлу. Дозволяються лише JPEG та PNG',
  fileTooLarge: 'Файл занадто великий. Максимальний розмір: 5MB',
  uploadFailed: 'Не вдалося завантажити флаєр',
  deleteFailed: 'Не вдалося видалити флаєр',
  noFlyer: 'Флаєр не знайдено',
};

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }
  if (!isAdmin(user)) {
    return forbidden();
  }

  const courseId = parseInt(params.id, 10);
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }

  const course = await getCourseById(courseId);
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('flyer') as File | null;
    if (!file) {
      return NextResponse.json({ error: ERROR_MESSAGES.noFile }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidFileType }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: ERROR_MESSAGES.fileTooLarge }, { status: 400 });
    }

    const oldFlyerPath = await getCourseFlyerPath(courseId);
    if (oldFlyerPath?.startsWith('https://')) {
      const oldPublicId = getPublicIdFromUrl(oldFlyerPath);
      if (oldPublicId) {
        await deleteImage(oldPublicId);
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extension = file.type === 'image/jpeg' ? 'jpg' : 'png';
    const filename = `flyer-${course.public_id}-${Date.now()}.${extension}`;
    const uploadResult = await uploadBuffer(buffer, 'course-flyers', filename);

    await updateCourseFlyerPath(courseId, uploadResult.url);
    await safeAddAuditEvent({
      entityType: 'course',
      entityId: courseId,
      entityPublicId: course.public_id,
      entityTitle: course.title,
      eventType: 'course_flyer_uploaded',
      eventBadge: toAuditBadge('course_flyer_uploaded'),
      description: `Оновлено флаєр курсу "${course.title}"`,
      userId: user.id,
      userName: user.name,
      courseId,
      metadata: {
        flyerPath: uploadResult.url,
        previousFlyerPath: oldFlyerPath,
        fileName: filename,
      },
    });

    return NextResponse.json({
      message: 'Флаєр успішно завантажено',
      flyer_path: uploadResult.url,
    });
  } catch (error) {
    console.error('Upload flyer error:', error);
    return NextResponse.json({ error: ERROR_MESSAGES.uploadFailed }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }
  if (!isAdmin(user)) {
    return forbidden();
  }

  const courseId = parseInt(params.id, 10);
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }

  const course = await getCourseById(courseId);
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }

  try {
    const flyerPath = await getCourseFlyerPath(courseId);
    if (!flyerPath) {
      return NextResponse.json({ error: ERROR_MESSAGES.noFlyer }, { status: 404 });
    }

    if (flyerPath.startsWith('https://')) {
      const publicId = getPublicIdFromUrl(flyerPath);
      if (publicId) {
        await deleteImage(publicId);
      }
    }

    await updateCourseFlyerPath(courseId, null);
    await safeAddAuditEvent({
      entityType: 'course',
      entityId: courseId,
      entityPublicId: course.public_id,
      entityTitle: course.title,
      eventType: 'course_flyer_deleted',
      eventBadge: toAuditBadge('course_flyer_deleted'),
      description: `Видалено флаєр курсу "${course.title}"`,
      userId: user.id,
      userName: user.name,
      courseId,
      metadata: {
        flyerPath,
      },
    });

    return NextResponse.json({ message: 'Флаєр успішно видалено' });
  } catch (error) {
    console.error('Delete flyer error:', error);
    return NextResponse.json({ error: ERROR_MESSAGES.deleteFailed }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorized();
  }

  const courseId = parseInt(params.id, 10);
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }

  const course = await getCourseById(courseId);
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }

  const flyerPath = await getCourseFlyerPath(courseId);

  return NextResponse.json({
    flyer_path: flyerPath,
    has_flyer: !!flyerPath,
  });
}
