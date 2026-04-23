import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';
import { createGlobalNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  status: string;
}

// POST /api/lessons/[id]/cancel - Cancel a lesson
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const lessonId = parseInt(params.id, 10);
  
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }
  
  const lesson = await get<Lesson>(
    `SELECT * FROM lessons WHERE id = $1`,
    [lessonId]
  );
  
  if (!lesson) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }
  
  // Check access
  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  // Check if already canceled
  if (lesson.status === 'canceled') {
    return NextResponse.json({ error: 'Заняття вже скасовано' }, { status: 400 });
  }
  
  try {
    const body = await request.json();
    const { reason } = body;
    
    await run(
      `UPDATE lessons SET status = 'canceled', topic = $1, updated_at = NOW() WHERE id = $2`,
      [reason || 'Скасовано', lessonId]
    );

    const lessonDetails = await get<{
      lesson_date: string;
      group_title: string | null;
      course_title: string | null;
    }>(
      `SELECT l.lesson_date::text as lesson_date, g.title as group_title, c.title as course_title
       FROM lessons l
       LEFT JOIN groups g ON l.group_id = g.id
       LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (lessonDetails) {
      const dateObj = new Date(lessonDetails.lesson_date);
      const formattedDate = `${String(dateObj.getUTCDate()).padStart(2, '0')}.${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}`;
      const name = lessonDetails.group_title || lessonDetails.course_title || 'Заняття';
      await createGlobalNotification(
        'lesson_canceled',
        `Заняття скасовано: ${name}`,
        `${formattedDate}${reason ? ` — ${reason}` : ''}`,
        '/schedule',
        { lessonId },
        `lesson_canceled:${lessonId}`
      );
    }

    return NextResponse.json({
      message: 'Заняття скасовано',
    });
  } catch (error) {
    console.error('Cancel lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося скасувати заняття' }, { status: 500 });
  }
}
