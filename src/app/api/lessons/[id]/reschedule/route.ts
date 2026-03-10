import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get } from '@/db';
import { rescheduleLesson } from '@/lib/lessons';
import { formatTimeKyiv } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

// PATCH /api/lessons/[id]/reschedule - Reschedule a lesson
export async function PATCH(
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

  const lessonInfo = await get<{ group_id: number | null; timezone: string }>(
    `SELECT l.group_id, COALESCE(g.timezone, 'Europe/Kyiv') as timezone
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     WHERE l.id = $1`,
    [lessonId]
  );

  if (!lessonInfo) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }

  // Check access
  if (lessonInfo.group_id) {
    const hasAccess = await checkGroupAccess(user, lessonInfo.group_id);
    if (!hasAccess) {
      return forbidden();
    }
  } else if (user.role !== 'admin') {
    return forbidden();
  }

  try {
    const body = await request.json();
    const { newDate, newStartTime, newEndTime } = body;

    if (!newDate || !newStartTime || !newEndTime) {
      return NextResponse.json({ error: 'Вкажіть нову дату та час' }, { status: 400 });
    }

    await rescheduleLesson(lessonId, newDate, newStartTime, newEndTime, lessonInfo.timezone);

    // Return formatted lesson (same shape as GET /api/lessons/[id])
    const updatedLesson = await get<{
      id: number;
      group_id: number | null;
      lesson_date: string;
      original_date: string | null;
      start_datetime: string;
      end_datetime: string;
      start_time_formatted: string | null;
      end_time_formatted: string | null;
      topic: string | null;
      notes: string | null;
      status: string;
      teacher_id: number | null;
      teacher_name: string | null;
      original_teacher_id: number | null;
      is_replaced: boolean;
      group_title: string | null;
      course_title: string | null;
      course_id: number | null;
    }>(
      `SELECT
        l.id,
        l.group_id,
        l.lesson_date,
        l.original_date,
        l.start_datetime,
        l.end_datetime,
        TO_CHAR(l.start_datetime, 'HH24:MI') as start_time_formatted,
        TO_CHAR(l.end_datetime, 'HH24:MI') as end_time_formatted,
        l.topic,
        l.notes,
        l.status,
        l.teacher_id,
        COALESCE(u.name, g_teacher.name) as teacher_name,
        g.teacher_id as original_teacher_id,
        COALESCE(l.course_id, g.course_id) as course_id,
        c.title as course_title,
        g.title as group_title,
        CASE WHEN l.teacher_id IS NOT NULL AND l.group_id IS NOT NULL AND l.teacher_id != g.teacher_id THEN TRUE ELSE FALSE END as is_replaced
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
      WHERE l.id = $1`,
      [lessonId]
    );

    if (!updatedLesson) {
      return NextResponse.json({ error: 'Не вдалося отримати оновлене заняття' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Заняття успішно перенесено',
      lesson: {
        id: updatedLesson.id,
        groupId: updatedLesson.group_id,
        groupTitle: updatedLesson.group_title,
        courseTitle: updatedLesson.course_title,
        courseId: updatedLesson.course_id,
        teacherId: updatedLesson.teacher_id || updatedLesson.original_teacher_id || null,
        teacherName: updatedLesson.teacher_name || 'Немає викладача',
        originalTeacherId: updatedLesson.original_teacher_id || null,
        isReplaced: updatedLesson.is_replaced,
        startTime: updatedLesson.start_time_formatted || formatTimeKyiv(updatedLesson.start_datetime),
        endTime: updatedLesson.end_time_formatted || formatTimeKyiv(updatedLesson.end_datetime),
        status: updatedLesson.status,
        topic: updatedLesson.topic,
        notes: updatedLesson.notes,
        originalDate: updatedLesson.original_date,
        isRescheduled: !!updatedLesson.original_date,
      },
    });
  } catch (error) {
    console.error('Reschedule lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося перенести заняття' }, { status: 500 });
  }
}
