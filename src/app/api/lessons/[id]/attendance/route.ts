import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { getAttendanceForLessonWithStudents, setAttendance, setAttendanceForAll, clearAttendanceForLesson, copyAttendanceFromPreviousLesson } from '@/lib/attendance';
import { get, run, all } from '@/db';
import { addGroupHistoryEntry, formatLessonConductedDescription } from '@/lib/group-history';
import { logLessonChange, checkAndAutoCancelLesson } from '@/lib/lessons';
import { safeAddStudentHistoryEntry, formatAttendanceDescription, StudentHistoryActionType } from '@/lib/student-history';
import { safeCreateLessonDoneNotification } from '@/lib/notifications';
import { useIndividualLesson } from '@/lib/individual-payments';

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

        // If this is a makeup lesson, sync original absence record and log it
        {
          const makeupLesson = await get<{ is_makeup: boolean | null; lesson_date: string }>(
            `SELECT is_makeup, lesson_date FROM lessons WHERE id = $1`,
            [lessonId]
          );
          if (makeupLesson?.is_makeup) {
            const origRecords = await all<{ lesson_id: number }>(
              `SELECT lesson_id FROM attendance WHERE makeup_lesson_id = $1 AND student_id = $2`,
              [lessonId, parseInt(studentId)]
            );
            const studentRow = await get<{ full_name: string }>(
              `SELECT full_name FROM students WHERE id = $1`,
              [parseInt(studentId)]
            );
            const studentLabel = studentRow?.full_name || `Учень #${studentId}`;
            const makeupDate = new Date(makeupLesson.lesson_date);
            const makeupDateStr = `${String(makeupDate.getUTCDate()).padStart(2,'0')}.${String(makeupDate.getUTCMonth()+1).padStart(2,'0')}.${makeupDate.getUTCFullYear()}`;

            if (status === 'present') {
              await run(
                `UPDATE attendance SET status = 'makeup_done', updated_by = $1, updated_at = NOW()
                 WHERE makeup_lesson_id = $2 AND student_id = $3`,
                [user.id, lessonId, parseInt(studentId)]
              );
              for (const rec of origRecords) {
                await logLessonChange(
                  rec.lesson_id, 'attendance', null,
                  `${studentLabel}: відпрацював пропуск (відпрацювання від ${makeupDateStr})`,
                  user.id, user.name, 'admin'
                );
              }
            } else if (status === 'absent') {
              await run(
                `UPDATE attendance SET status = 'makeup_planned', updated_by = $1, updated_at = NOW()
                 WHERE makeup_lesson_id = $2 AND student_id = $3 AND status = 'makeup_done'`,
                [user.id, lessonId, parseInt(studentId)]
              );
              for (const rec of origRecords) {
                await logLessonChange(
                  rec.lesson_id, 'attendance', null,
                  `${studentLabel}: відпрацювання скасовано`,
                  user.id, user.name, 'admin'
                );
              }
            }
          }
        }

        const lessonInfo = await get<{ group_id: number | null; status: string; lesson_date: string; topic: string }>(
          `SELECT group_id, status, lesson_date, topic FROM lessons WHERE id = $1`,
          [lessonId]
        );

        // Auto-cancel if all students are absent; otherwise mark as done when all recorded
        if (lessonInfo && lessonInfo.status === 'scheduled') {
          const cancelled = await checkAndAutoCancelLesson(lessonId, user.id, user.name, 'admin');

          if (!cancelled && lessonInfo.group_id !== null) {
            const counts = await get<{ total: number; recorded: number }>(
              `SELECT
                (SELECT COUNT(*) FROM student_groups WHERE group_id = $2 AND is_active = TRUE) as total,
                (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IS NOT NULL) as recorded`,
              [lessonId, lessonInfo.group_id]
            );

            if (counts && counts.total > 0 && counts.recorded >= counts.total) {
              await run(`UPDATE lessons SET status = 'done', updated_at = NOW() WHERE id = $1`, [lessonId]);

              await addGroupHistoryEntry(
                lessonInfo.group_id,
                'lesson_conducted',
                formatLessonConductedDescription(lessonInfo.lesson_date, lessonInfo.topic),
                user.id,
                user.name
              );

              await safeCreateLessonDoneNotification(lessonId, user.name);
            }
          }

          // Individual lesson: mark as done and deduct from balance
          if (!cancelled && lessonInfo.group_id === null) {
            const indCounts = await get<{ total: number; recorded: number }>(
              `SELECT
                (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1) as total,
                (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IS NOT NULL) as recorded`,
              [lessonId]
            );

            if (indCounts && indCounts.total > 0 && indCounts.recorded >= indCounts.total) {
              await run(`UPDATE lessons SET status = 'done', updated_at = NOW() WHERE id = $1`, [lessonId]);

              // Deduct from individual balance for each present student
              const presentStudents = await all<{ student_id: number }>(
                `SELECT student_id FROM attendance WHERE lesson_id = $1 AND status = 'present'`,
                [lessonId]
              );
              for (const ps of presentStudents) {
                await useIndividualLesson(ps.student_id);
              }
            }
          }
        }

        // Log student history entry for attendance
        if (lessonInfo && studentId) {
          let historyActionType: StudentHistoryActionType;
          if (status === 'present') historyActionType = 'lesson_attended';
          else if (status === 'absent') historyActionType = 'lesson_missed';
          else if (status === 'makeup_planned') historyActionType = 'lesson_makeup_planned';
          else if (status === 'makeup_done') historyActionType = 'lesson_makeup_done';
          else historyActionType = 'lesson_attended';

          let groupTitle: string | null = null;
          if (lessonInfo.group_id) {
            const grp = await get<{ title: string }>(`SELECT title FROM groups WHERE id = $1`, [lessonInfo.group_id]);
            groupTitle = grp?.title ?? null;
          }

          const isIndividual = lessonInfo.group_id === null;
          const description = formatAttendanceDescription(status, lessonInfo.lesson_date, groupTitle, lessonInfo.topic, isIndividual);

          await safeAddStudentHistoryEntry(parseInt(studentId), historyActionType, description, user.id, user.name);
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

        // Auto-cancel if all absent; otherwise mark as done
        {
          const setAllLessonInfo = await get<{ group_id: number | null; status: string; lesson_date: string; topic: string }>(
            `SELECT group_id, status, lesson_date, topic FROM lessons WHERE id = $1`,
            [lessonId]
          );
          if (setAllLessonInfo && setAllLessonInfo.status === 'scheduled') {
            const cancelled = await checkAndAutoCancelLesson(lessonId, user.id, user.name, 'admin');
            if (!cancelled && setAllLessonInfo.group_id !== null) {
              const counts = await get<{ total: number; recorded: number }>(
                `SELECT
                  (SELECT COUNT(*) FROM student_groups WHERE group_id = $2 AND is_active = TRUE) as total,
                  (SELECT COUNT(*) FROM attendance WHERE lesson_id = $1 AND status IS NOT NULL) as recorded`,
                [lessonId, setAllLessonInfo.group_id]
              );
              if (counts && counts.total > 0 && counts.recorded >= counts.total) {
                await run(`UPDATE lessons SET status = 'done', updated_at = NOW() WHERE id = $1`, [lessonId]);
                await addGroupHistoryEntry(
                  setAllLessonInfo.group_id,
                  'lesson_conducted',
                  formatLessonConductedDescription(setAllLessonInfo.lesson_date, setAllLessonInfo.topic),
                  user.id,
                  user.name
                );
                await safeCreateLessonDoneNotification(lessonId, user.name);
              }
            }
          }
        }

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
