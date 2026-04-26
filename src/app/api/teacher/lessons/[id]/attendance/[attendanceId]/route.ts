/**
 * DELETE /api/teacher/lessons/[id]/attendance/[attendanceId]
 *
 * Видалення помилкової позначки присутності.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAttendanceForMyLesson,
  listAttendanceForMyLesson,
} from '@/lib/teacher-data';
import {
  requireTeacher,
  handleTeacherApiError,
  parsePositiveInt,
} from '@/lib/teacher-api-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attendanceId: string } },
) {
  const teacher = await requireTeacher(request);
  if (teacher instanceof NextResponse) return teacher;

  const lessonId = parsePositiveInt(params.id);
  const attendanceId = parsePositiveInt(params.attendanceId);
  if (!lessonId || !attendanceId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    await deleteAttendanceForMyLesson(teacher.id, lessonId, attendanceId);
    const attendance = await listAttendanceForMyLesson(teacher.id, lessonId);
    return NextResponse.json({ attendance });
  } catch (e) {
    const handled = handleTeacherApiError(e);
    if (handled) return handled;
    console.error('[teacher/attendance DELETE] error:', e);
    return NextResponse.json({ error: 'Не вдалося видалити' }, { status: 500 });
  }
}
