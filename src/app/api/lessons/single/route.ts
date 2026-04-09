import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import {
  createLessonsBatch,
  findTeacherScheduleConflicts,
  type ManualLessonSlot,
} from '@/lib/lessons';
import { get, run } from '@/db';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  missingRequiredFields: "Відсутні обов'язкові поля",
  invalidDate: 'Некоректна дата',
  invalidTime: 'Некоректний час',
  invalidDuration: 'Тривалість повинна бути числом від 1 до 480 хвилин',
  groupNotFound: 'Групу не знайдено',
  courseNotFound: 'Курс не знайдено',
  teacherNotFound: 'Викладача не знайдено',
  createFailed: 'Не вдалося створити заняття',
};

function validateDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !Number.isNaN(date.getTime());
}

function validateTime(timeStr: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeStr);
}

function validateDuration(duration: number): boolean {
  return Number.isInteger(duration) && duration >= 1 && duration <= 480;
}

function normalizeSlots(body: any): ManualLessonSlot[] {
  if (Array.isArray(body?.slots) && body.slots.length > 0) {
    return body.slots;
  }

  return [{
    lessonDate: body?.lessonDate,
    startTime: body?.startTime,
    durationMinutes: body?.durationMinutes,
  }];
}

function buildAttendanceInsertParams(lessonId: number, studentIds: number[]) {
  const placeholders: string[] = [];
  const params: Array<number | null> = [];

  studentIds.forEach((studentId, index) => {
    const offset = index * 3;
    placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
    params.push(lessonId, studentId, null);
  });

  return { placeholders, params };
}

function findOverlappingRequestSlots(slots: ManualLessonSlot[]) {
  const normalized = slots
    .map((slot, index) => {
      const start = new Date(`${slot.lessonDate}T${slot.startTime}:00`);
      const end = new Date(start.getTime() + slot.durationMinutes * 60 * 1000);

      return {
        ...slot,
        index,
        start,
        end,
      };
    })
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  for (let index = 1; index < normalized.length; index++) {
    const previous = normalized[index - 1];
    const current = normalized[index];

    if (previous.start.getTime() === current.start.getTime()) {
      return `Слоти ${previous.index + 1} і ${current.index + 1} дублюють один одного`;
    }

    if (previous.end > current.start) {
      return `Слоти ${previous.index + 1} і ${current.index + 1} перетинаються в часі`;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  if (user.role !== 'admin') {
    return forbidden();
  }

  try {
    const body = await request.json();
    const {
      courseId,
      teacherId,
      groupId,
      studentIds,
      isTrial,
    } = body;

    const slots = normalizeSlots(body);

    if (!teacherId || slots.length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingRequiredFields },
        { status: 400 }
      );
    }

    if (isTrial && slots.length > 1) {
      return NextResponse.json(
        { error: 'Пробне заняття можна запланувати лише як один слот' },
        { status: 400 }
      );
    }

    for (let index = 0; index < slots.length; index++) {
      const slot = slots[index];
      if (!slot?.lessonDate || !slot?.startTime || !slot?.durationMinutes) {
        return NextResponse.json(
          { error: `Заповніть усі обов'язкові поля для слоту ${index + 1}` },
          { status: 400 }
        );
      }

      if (!validateDate(slot.lessonDate)) {
        return NextResponse.json(
          { error: `${ERROR_MESSAGES.invalidDate} у слоті ${index + 1}` },
          { status: 400 }
        );
      }

      if (!validateTime(slot.startTime)) {
        return NextResponse.json(
          { error: `${ERROR_MESSAGES.invalidTime} у слоті ${index + 1}` },
          { status: 400 }
        );
      }

      if (!validateDuration(Number(slot.durationMinutes))) {
        return NextResponse.json(
          { error: `${ERROR_MESSAGES.invalidDuration} у слоті ${index + 1}` },
          { status: 400 }
        );
      }
    }

    if (!groupId && !studentIds?.length && !courseId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingRequiredFields },
        { status: 400 }
      );
    }

    if (!groupId && (!studentIds || studentIds.length === 0)) {
      return NextResponse.json(
        { error: 'Потрібно обрати групу або учнів' },
        { status: 400 }
      );
    }

    const uniqueStudentIds = Array.isArray(studentIds)
      ? Array.from(new Set(
          studentIds
            .map((studentId: unknown) => Number(studentId))
            .filter((studentId: number) => Number.isInteger(studentId) && studentId > 0)
        ))
      : [];

    if (!groupId && uniqueStudentIds.length === 0) {
      return NextResponse.json(
        { error: 'Потрібно обрати хоча б одного учня' },
        { status: 400 }
      );
    }

    if (courseId) {
      const course = await get<{ id: number }>(
        'SELECT id FROM courses WHERE id = $1',
        [courseId]
      );

      if (!course) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.courseNotFound },
          { status: 404 }
        );
      }
    }

    const teacher = await get<{ id: number }>(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [teacherId, 'teacher']
    );

    if (!teacher) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.teacherNotFound },
        { status: 404 }
      );
    }

    if (groupId) {
      const group = await get<{ id: number }>(
        'SELECT id FROM groups WHERE id = $1',
        [groupId]
      );

      if (!group) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.groupNotFound },
          { status: 404 }
        );
      }
    }

    const overlapError = findOverlappingRequestSlots(slots);
    if (overlapError) {
      return NextResponse.json(
        { error: overlapError },
        { status: 400 }
      );
    }

    const teacherConflicts = await findTeacherScheduleConflicts(teacherId, slots);
    if (teacherConflicts.length > 0) {
      const firstConflict = teacherConflicts[0];
      const lessonLabel = firstConflict.group_title || firstConflict.course_title || 'іншим заняттям';

      return NextResponse.json(
        {
          error: `Викладач уже зайнятий ${firstConflict.lesson_date} о ${firstConflict.start_time}-${firstConflict.end_time} (${lessonLabel})`,
        },
        { status: 409 }
      );
    }

    const lessons = await createLessonsBatch(
      {
        groupId: groupId ?? null,
        courseId: courseId ?? null,
        teacherId,
        isTrial: !!isTrial,
        slots,
      },
      user.id
    );

    if (!groupId && uniqueStudentIds.length > 0) {
      for (const lesson of lessons) {
        const { placeholders, params } = buildAttendanceInsertParams(lesson.id, uniqueStudentIds);

        await run(
          `INSERT INTO attendance (lesson_id, student_id, status)
           VALUES ${placeholders.join(', ')}
           ON CONFLICT (lesson_id, student_id) DO NOTHING`,
          params
        );
      }
    }

    return NextResponse.json({
      message: lessons.length === 1
        ? 'Заняття успішно створено'
        : `Успішно створено ${lessons.length} занять`,
      lessonId: lessons[0]?.id ?? null,
      lessonIds: lessons.map(lesson => lesson.id),
      publicId: lessons[0]?.publicId ?? null,
      publicIds: lessons.map(lesson => lesson.publicId),
      createdCount: lessons.length,
    });
  } catch (error) {
    console.error('[Create Single Lesson] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : ERROR_MESSAGES.createFailed },
      { status: 500 }
    );
  }
}

