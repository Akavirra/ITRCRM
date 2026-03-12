import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { getAttendanceForLessonWithStudents, setAttendance, setAttendanceForAll, clearAttendanceForLesson, copyAttendanceFromPreviousLesson } from '@/lib/attendance';
import { get, run } from '@/db';
import { addGroupHistoryEntry, formatLessonConductedDescription } from '@/lib/group-history';
import { logLessonChange } from '@/lib/lessons';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidLessonId: 'Невірний ID заняття',
  lessonNotFound: 'Заняття не знайдено',
  studentIdAndStatusRequired: "ID учня та статус обов'язкові",
  statusRequired: "Статус обов'язковий",
  invalidAction: 'Невірна дія',
  setAttendanceFailed: 'Не вдалося встановити відвідуваність',
};

// GET /api/lessons/[id]/attendance - Get attendance for lesson
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const lessonId = parseInt(params.id, 10);
  
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidLessonId }, { status: 400 });
  }
  
  // Get lesson to check group access
  const lesson = await get<{ group_id: number | null }>(`SELECT group_id FROM lessons WHERE id = $1`, [lessonId]);

  if (!lesson) {
    return NextResponse.json({ error: ERROR_MESSAGES.lessonNotFound }, { status: 404 });
  }

  // Individual lessons (group_id = null) are accessible to admins only
  if (lesson.group_id !== null) {
    const hasAccess = await checkGroupAccess(user, lesson.group_id);
    if (!hasAccess) {
      return forbidden();
    }
  }

  const attendance = await getAttendanceForLessonWithStudents(lessonId);
  
  return NextResponse.json({ attendance });
}

// POST /api/lessons/[id]/attendance - Set attendance
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
    return NextResponse.json({ error: ERROR_MESSAGES.invalidLessonId }, { status: 400 });
  }
  
  // Get lesson to check group access
  const lesson = await get<{ group_id: number | null }>(`SELECT group_id FROM lessons WHERE id = $1`, [lessonId]);

  if (!lesson) {
    return NextResponse.json({ error: ERROR_MESSAGES.lessonNotFound }, { status: 404 });
  }

  // Individual lessons (group_id = null) are accessible to admins only
  if (lesson.group_id !== null) {
    const hasAccess = await checkGroupAccess(user, lesson.group_id);
    if (!hasAccess) {
      return forbidden();
    }
  }

  try {
    const body = await request.json();
    const { action, studentId, status, comment, makeupLessonId } = body;
    
    switch (action) {
      case 'set':
        if (!studentId || !status) {
          return NextResponse.json(
            { error: ERROR_MESSAGES.studentIdAndStatusRequired },
            { status: 400 }
          );
        }
        await setAttendance(lessonId, parseInt(studentId), status, user.id, comment, makeupLessonId);

        // If this is a makeup lesson, sync original absence record
        {
          const makeupLesson = await get<{ is_makeup: boolean | null }>(
            `SELECT is_makeup FROM lessons WHERE id = $1`,
            [lessonId]
          );
          if (makeupLesson?.is_makeup) {
            if (status === 'present') {
              // Mark original absence as makeup_done
              await run(
                `UPDATE attendance SET status = 'makeup_done', updated_by = $1, updated_at = NOW()
                 WHERE makeup_lesson_id = $2 AND student_id = $3`,
                [user.id, lessonId, parseInt(studentId)]
              );
            } else if (status === 'absent') {
              // Revert original absence back to makeup_planned
              await run(
                `UPDATE attendance SET status = 'makeup_planned', updated_by = $1, updated_at = NOW()
                 WHERE makeup_lesson_id = $2 AND student_id = $3 AND status = 'makeup_done'`,
                [user.id, lessonId, parseInt(studentId)]
              );
            }
          }
        }

        const lessonInfo = await get<{ group_id: number | null; status: string; lesson_date: string; topic: string }>(
          `SELECT group_id, status, lesson_date, topic FROM lessons WHERE id = $1`,
          [lessonId]
        );

        // Mark lesson as 'done' only when ALL active students have attendance recorded
        if (lessonInfo && lessonInfo.status === 'scheduled' && lessonInfo.group_id !== null) {
          const counts = await get<{ total: number; recorded: number }>(
            `SELECT
              (SELECT COUNT(*) FROM student_groups WHERE group_id = $2 AND is_active = TRUE) as total,
              (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IS NOT NULL) as recorded`,
            [lessonId, lessonInfo.group_id]
          );

          if (counts && counts.total > 0 && counts.recorded >= counts.total) {
            await run(`UPDATE lessons SET status = 'done', updated_at = NOW() WHERE id = $1`, [lessonId]);

            if (lessonInfo.group_id) {
              await addGroupHistoryEntry(
                lessonInfo.group_id,
                'lesson_conducted',
                formatLessonConductedDescription(lessonInfo.lesson_date, lessonInfo.topic),
                user.id,
                user.name
              );
            }
          }
        }
        
        // Log attendance change
        await logLessonChange(
          lessonId,
          'attendance',
          null,
          'Відвідуваність відмічено',
          user.id,
          user.name,
          'admin'
        );
        
        return NextResponse.json({ message: 'Відвідуваність успішно встановлена' });
        
      case 'setAll':
        if (!status) {
          return NextResponse.json(
            { error: ERROR_MESSAGES.statusRequired },
            { status: 400 }
          );
        }
        await setAttendanceForAll(lessonId, status, user.id);
        
        // Log attendance change
        await logLessonChange(
          lessonId,
          'attendance',
          null,
          `Відвідуваність для всіх: ${status}`,
          user.id,
          user.name,
          'admin'
        );
        
        return NextResponse.json({ message: 'Відвідуваність для всіх успішно встановлена' });
        
      case 'clear':
        await clearAttendanceForLesson(lessonId);
        
        // Log attendance change
        await logLessonChange(
          lessonId,
          'attendance',
          null,
          'Відвідуваність очищена',
          user.id,
          user.name,
          'admin'
        );
        
        return NextResponse.json({ message: 'Відвідуваність успішно очищена' });
        
      case 'copyPrevious':
        const result = await copyAttendanceFromPreviousLesson(lessonId, user.id);
        
        // Log attendance change
        await logLessonChange(
          lessonId,
          'attendance',
          null,
          `Скопійовано ${result.copied} записів з попереднього заняття`,
          user.id,
          user.name,
          'admin'
        );
        
        return NextResponse.json({ 
          message: 'Відвідуваність успішно скопійована',
          copied: result.copied 
        });
        
      default:
        return NextResponse.json(
          { error: ERROR_MESSAGES.invalidAction },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Set attendance error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.setAttendanceFailed },
      { status: 500 }
    );
  }
}
