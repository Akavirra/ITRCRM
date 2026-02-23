import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';
import { parseISO, setHours, setMinutes, format } from 'date-fns';
import { addGroupHistoryEntry, formatLessonConductedDescription } from '@/lib/group-history';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  status: string;
  created_by: number;
}

// GET /api/lessons/[id] - Get a specific lesson
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
  
  // Get lesson with group, course and teacher details
  const lessonWithDetails = await get<Lesson & { group_title: string; course_title: string; teacher_id: number; teacher_name: string; original_teacher_id: number; is_replaced: boolean }>(
    `SELECT 
      l.id,
      l.group_id,
      l.lesson_date,
      l.start_datetime,
      l.end_datetime,
      l.topic,
      l.status,
      l.created_by,
      COALESCE(l.teacher_id, g.teacher_id) as teacher_id,
      COALESCE(u.name, g_teacher.name) as teacher_name,
      g.teacher_id as original_teacher_id,
      CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced
    FROM lessons l
    JOIN groups g ON l.group_id = g.id
    JOIN courses c ON g.course_id = c.id
    LEFT JOIN users u ON l.teacher_id = u.id
    LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
    WHERE l.id = $1`,
    [lessonId]
  );
  
  // Transform to camelCase format
  const transformedLesson = lessonWithDetails ? {
    id: lessonWithDetails.id,
    groupId: lessonWithDetails.group_id,
    groupTitle: lessonWithDetails.group_title,
    courseTitle: lessonWithDetails.course_title,
    teacherId: lessonWithDetails.teacher_id,
    teacherName: lessonWithDetails.teacher_name,
    originalTeacherId: lessonWithDetails.original_teacher_id,
    isReplaced: lessonWithDetails.is_replaced,
    startTime: lessonWithDetails.start_datetime.split(' ')[1].substring(0, 5),
    endTime: lessonWithDetails.end_datetime.split(' ')[1].substring(0, 5),
    status: lessonWithDetails.status,
    topic: lessonWithDetails.topic,
  } : null;
  
  return NextResponse.json({ lesson: transformedLesson });
}

// PATCH /api/lessons/[id] - Update a lesson
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
  
  try {
    const body = await request.json();
    const { topic, status, lesson_date, start_time } = body;
    
    let updates: string[] = ['updated_at = NOW()'];
    let params: (string | number)[] = [];
    
    if (topic !== undefined) {
      updates.push(`topic = $${params.length + 1}`);
      params.push(topic);
    }
    
    if (status !== undefined) {
      if (!['scheduled', 'done', 'canceled'].includes(status)) {
        return NextResponse.json({ error: 'Невірний статус' }, { status: 400 });
      }
      
      // Add history entry when lesson is marked as done
      if (status === 'done' && lesson.status !== 'done') {
        await addGroupHistoryEntry(
          lesson.group_id,
          'lesson_conducted',
          formatLessonConductedDescription(lesson.lesson_date, lesson.topic),
          user.id,
          user.name
        );
      }
      
      updates.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    
    // If changing date/time, recalculate datetime fields
    if (lesson_date || start_time) {
      const newDate = lesson_date ? parseISO(lesson_date) : parseISO(lesson.lesson_date);
      const newTime = start_time ? start_time : lesson.start_datetime.split(' ')[1].substring(0, 5);
      const [hours, minutes] = newTime.split(':').map(Number);
      
      const startDateTime = setMinutes(setHours(newDate, hours), minutes);
      const endDateTime = new Date(startDateTime.getTime() + 90 * 60 * 1000); // Default 90 min
      
      updates.push(`lesson_date = $${params.length + 1}`);
      params.push(format(newDate, 'yyyy-MM-dd'));
      updates.push(`start_datetime = $${params.length + 1}`);
      params.push(format(startDateTime, 'yyyy-MM-dd HH:mm:ss'));
      updates.push(`end_datetime = $${params.length + 1}`);
      params.push(format(endDateTime, 'yyyy-MM-dd HH:mm:ss'));
    }
    
    params.push(lessonId);
    
    const sql = `UPDATE lessons SET ${updates.join(', ')} WHERE id = $${params.length}`;
    await run(sql, params);
    
    // Get updated lesson with group, course and teacher details
    const updatedLessonRaw = await get<Lesson & { group_title: string; course_title: string; teacher_id: number; teacher_name: string; original_teacher_id: number; is_replaced: boolean }>(
      `SELECT 
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        l.topic,
        l.status,
        l.created_by,
        COALESCE(l.teacher_id, g.teacher_id) as teacher_id,
        COALESCE(u.name, g_teacher.name) as teacher_name,
        g.teacher_id as original_teacher_id,
        CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
      WHERE l.id = $1`,
      [lessonId]
    );
    
    // Transform to camelCase format
    const updatedLesson = updatedLessonRaw ? {
      id: updatedLessonRaw.id,
      groupId: updatedLessonRaw.group_id,
      groupTitle: updatedLessonRaw.group_title,
      courseTitle: updatedLessonRaw.course_title,
      teacherId: updatedLessonRaw.teacher_id,
      teacherName: updatedLessonRaw.teacher_name,
      originalTeacherId: updatedLessonRaw.original_teacher_id,
      isReplaced: updatedLessonRaw.is_replaced,
      startTime: updatedLessonRaw.start_datetime.split(' ')[1].substring(0, 5),
      endTime: updatedLessonRaw.end_datetime.split(' ')[1].substring(0, 5),
      status: updatedLessonRaw.status,
      topic: updatedLessonRaw.topic,
    } : null;
    
    return NextResponse.json({
      message: 'Заняття оновлено',
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити заняття' }, { status: 500 });
  }
}

// DELETE /api/lessons/[id] - Delete a lesson (permanent)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (user.role !== 'admin') {
    return forbidden();
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
  
  // Check for attendance records
  const attendanceCount = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM attendance WHERE lesson_id = $1`,
    [lessonId]
  );
  
  if (attendanceCount && attendanceCount.count > 0) {
    return NextResponse.json(
      { error: 'Неможливо видалити заняття: є записи відвідуваності' },
      { status: 400 }
    );
  }
  
  await run(`DELETE FROM lessons WHERE id = $1`, [lessonId]);
  
  return NextResponse.json({ message: 'Заняття видалено' });
}
