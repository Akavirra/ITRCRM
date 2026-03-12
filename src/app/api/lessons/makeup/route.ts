import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { createSingleLesson } from '@/lib/lessons';
import { get, run, all } from '@/db';

export const dynamic = 'force-dynamic';

function validateDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}
function validateTime(s: string) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
}

// POST /api/lessons/makeup
// Creates an individual makeup lesson and links it to selected absence records.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const body = await request.json();
  const {
    lessonDate,
    startTime,
    durationMinutes,
    courseId,
    teacherId,
    attendanceIds, // number[] — absence records being resolved
  }: {
    lessonDate: string;
    startTime: string;
    durationMinutes: number;
    courseId: number | null;
    teacherId: number;
    attendanceIds: number[];
  } = body;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!lessonDate || !startTime || !durationMinutes || !teacherId) {
    return NextResponse.json({ error: "Відсутні обов'язкові поля" }, { status: 400 });
  }
  if (!validateDate(lessonDate)) {
    return NextResponse.json({ error: 'Некоректна дата' }, { status: 400 });
  }
  if (!validateTime(startTime)) {
    return NextResponse.json({ error: 'Некоректний час' }, { status: 400 });
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) {
    return NextResponse.json({ error: 'Тривалість повинна бути від 1 до 480 хвилин' }, { status: 400 });
  }
  if (!Array.isArray(attendanceIds) || attendanceIds.length === 0) {
    return NextResponse.json({ error: 'Не обрано жодного пропуску' }, { status: 400 });
  }

  // ── Verify teacher ──────────────────────────────────────────────────────────
  const teacher = await get<{ id: number }>(
    `SELECT id FROM users WHERE id = $1 AND role = 'teacher'`,
    [teacherId]
  );
  if (!teacher) {
    return NextResponse.json({ error: 'Викладача не знайдено' }, { status: 404 });
  }

  // ── Verify course (optional) ────────────────────────────────────────────────
  if (courseId) {
    const course = await get<{ id: number }>(`SELECT id FROM courses WHERE id = $1`, [courseId]);
    if (!course) {
      return NextResponse.json({ error: 'Курс не знайдено' }, { status: 404 });
    }
  }

  // ── Fetch and validate selected absence records ─────────────────────────────
  const placeholders = attendanceIds.map((_, i) => `$${i + 1}`).join(', ');
  const absences = await all<{ id: number; student_id: number; status: string }>(
    `SELECT id, student_id, status
     FROM attendance
     WHERE id IN (${placeholders})
       AND (status = 'absent' OR (status = 'makeup_planned' AND makeup_lesson_id IS NULL))`,
    attendanceIds
  );

  if (absences.length === 0) {
    return NextResponse.json({ error: 'Обрані пропуски не знайдені або вже мають відпрацювання' }, { status: 400 });
  }

  // Derive unique student IDs from the verified absences
  const studentIds = Array.from(new Set(absences.map(a => a.student_id)));

  // ── Create makeup lesson ────────────────────────────────────────────────────
  const lesson = await createSingleLesson(
    { groupId: null, courseId, lessonDate, startTime, durationMinutes, teacherId },
    user.id
  );

  // ── Add attendance stubs for each student in the makeup lesson ──────────────
  for (const studentId of studentIds) {
    await run(
      `INSERT INTO attendance (lesson_id, student_id, status)
       VALUES ($1, $2, NULL)
       ON CONFLICT (lesson_id, student_id) DO NOTHING`,
      [lesson.id, studentId]
    );
  }

  // ── Link original absence records to this makeup lesson ─────────────────────
  const verifiedIds = absences.map(a => a.id);
  const updatePlaceholders = verifiedIds.map((_, i) => `$${i + 2}`).join(', ');
  await run(
    `UPDATE attendance
     SET status = 'makeup_planned',
         makeup_lesson_id = $1
     WHERE id IN (${updatePlaceholders})`,
    [lesson.id, ...verifiedIds]
  );

  return NextResponse.json({
    message: `Відпрацювання створено для ${studentIds.length} учн${studentIds.length === 1 ? 'я' : 'ів'}`,
    lessonId: lesson.id,
    publicId: lesson.publicId,
    linkedAbsences: verifiedIds.length,
  });
}
