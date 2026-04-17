import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getCourseById, archiveCourse, restoreCourse } from '@/lib/courses';
import { clearServerCache } from '@/lib/server-cache';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ error: 'Невірний ID курсу' }, { status: 400 });
  }

  const existingCourse = await getCourseById(courseId);
  if (!existingCourse) {
    return notFound('Курс не знайдено');
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'restore') {
      await restoreCourse(courseId);
      clearServerCache('courses:');
      await safeAddAuditEvent({
        entityType: 'course',
        entityId: courseId,
        entityPublicId: existingCourse.public_id,
        entityTitle: existingCourse.title,
        eventType: 'course_restored',
        eventBadge: toAuditBadge('course_restored'),
        description: `Курс "${existingCourse.title}" відновлено`,
        userId: user.id,
        userName: user.name,
        courseId,
      });
      return NextResponse.json({ message: 'Курс успішно відновлено', is_active: 1 });
    }

    await archiveCourse(courseId);
    clearServerCache('courses:');
    await safeAddAuditEvent({
      entityType: 'course',
      entityId: courseId,
      entityPublicId: existingCourse.public_id,
      entityTitle: existingCourse.title,
      eventType: 'course_archived',
      eventBadge: toAuditBadge('course_archived'),
      description: `Курс "${existingCourse.title}" архівовано`,
      userId: user.id,
      userName: user.name,
      courseId,
    });
    return NextResponse.json({ message: 'Курс успішно архівовано', is_active: 0 });
  } catch (error) {
    console.error('Archive/restore course error:', error);
    return NextResponse.json({ error: 'Сталася помилка. Спробуйте ще раз.' }, { status: 500 });
  }
}
