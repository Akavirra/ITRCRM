import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getCourseById, archiveCourse, restoreCourse } from '@/lib/courses';

export const dynamic = 'force-dynamic';

// POST /api/courses/[id]/archive - Archive or restore a course
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
  
  const existingCourse = getCourseById(courseId);
  
  if (!existingCourse) {
    return notFound('Курс не знайдено');
  }
  
  try {
    const body = await request.json();
    const { action } = body; // 'archive' or 'restore'
    
    if (action === 'restore') {
      restoreCourse(courseId);
      return NextResponse.json({ message: 'Курс успішно відновлено', is_active: 1 });
    } else {
      // Default action is archive
      archiveCourse(courseId);
      return NextResponse.json({ message: 'Курс успішно архівовано', is_active: 0 });
    }
  } catch (error) {
    console.error('Archive/restore course error:', error);
    return NextResponse.json(
      { error: 'Сталася помилка. Спробуйте ще раз.' },
      { status: 500 }
    );
  }
}
