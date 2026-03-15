import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { get, all, run } from '@/db';

export const dynamic = 'force-dynamic';

// POST /api/lessons/[id]/prep-reschedule
// For individual lessons: returns teacherId, courseId, studentIds
// For makeup lessons: resets original absences' makeup_lesson_id → NULL, returns teacherId, absenceIds
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const lessonId = parseInt(params.id, 10);
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }

  const lesson = await get<{
    id: number;
    group_id: number | null;
    is_makeup: boolean;
    teacher_id: number | null;
    course_id: number | null;
    status: string;
  }>(
    `SELECT id, group_id, is_makeup, teacher_id, course_id, status FROM lessons WHERE id = $1`,
    [lessonId]
  );

  if (!lesson) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }

  if (lesson.status !== 'canceled') {
    return NextResponse.json({ error: 'Тільки скасовані заняття можна перенести' }, { status: 400 });
  }

  if (lesson.is_makeup) {
    // Makeup: get original absence IDs linked to this makeup lesson, then release them
    const originalAbsences = await all<{ id: number }>(
      `SELECT id FROM attendance WHERE makeup_lesson_id = $1`,
      [lessonId]
    );

    if (originalAbsences.length > 0) {
      await run(
        `UPDATE attendance SET makeup_lesson_id = NULL WHERE makeup_lesson_id = $1`,
        [lessonId]
      );
    }

    return NextResponse.json({
      type: 'makeup',
      teacherId: lesson.teacher_id,
      absenceIds: originalAbsences.map(a => a.id),
    });
  }

  // Individual lesson: get student IDs from attendance records
  const attendanceRecords = await all<{ student_id: number }>(
    `SELECT DISTINCT student_id FROM attendance WHERE lesson_id = $1`,
    [lessonId]
  );

  return NextResponse.json({
    type: 'individual',
    teacherId: lesson.teacher_id,
    courseId: lesson.course_id,
    studentIds: attendanceRecords.map(a => a.student_id),
  });
}
