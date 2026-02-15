import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { getAttendanceForLessonWithStudents, setAttendance, setAttendanceForAll, clearAttendanceForLesson, copyAttendanceFromPreviousLesson } from '@/lib/attendance';
import { get } from '@/db';

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
  const lesson = get<{ group_id: number }>(`SELECT group_id FROM lessons WHERE id = ?`, [lessonId]);
  
  if (!lesson) {
    return NextResponse.json({ error: ERROR_MESSAGES.lessonNotFound }, { status: 404 });
  }
  
  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  const attendance = getAttendanceForLessonWithStudents(lessonId);
  
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
  const lesson = get<{ group_id: number }>(`SELECT group_id FROM lessons WHERE id = ?`, [lessonId]);
  
  if (!lesson) {
    return NextResponse.json({ error: ERROR_MESSAGES.lessonNotFound }, { status: 404 });
  }
  
  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  
  if (!hasAccess) {
    return forbidden();
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
        setAttendance(lessonId, parseInt(studentId), status, user.id, comment, makeupLessonId);
        return NextResponse.json({ message: 'Відвідуваність успішно встановлена' });
        
      case 'setAll':
        if (!status) {
          return NextResponse.json(
            { error: ERROR_MESSAGES.statusRequired },
            { status: 400 }
          );
        }
        setAttendanceForAll(lessonId, status, user.id);
        return NextResponse.json({ message: 'Відвідуваність для всіх успішно встановлена' });
        
      case 'clear':
        clearAttendanceForLesson(lessonId);
        return NextResponse.json({ message: 'Відвідуваність успішно очищена' });
        
      case 'copyPrevious':
        const result = copyAttendanceFromPreviousLesson(lessonId, user.id);
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
