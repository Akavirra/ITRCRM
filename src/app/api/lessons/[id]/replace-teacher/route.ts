import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';

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
  teacher_id: number | null;
}

// POST /api/lessons/[id]/replace-teacher - Replace teacher for a lesson
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
  
  try {
    const body = await request.json();
    const { replacementTeacherId, reason } = body;
    
    if (!replacementTeacherId) {
      return NextResponse.json({ error: 'ID нового викладача обов\'язковий' }, { status: 400 });
    }
    
    // Get original teacher from group
    const group = await get<{ teacher_id: number }>(
      `SELECT teacher_id FROM groups WHERE id = $1`,
      [lesson.group_id]
    );
    
    if (!group) {
      return NextResponse.json({ error: 'Групу не знайдено' }, { status: 404 });
    }
    
    const originalTeacherId = group.teacher_id;
    
    // Verify replacement teacher exists and is a teacher
    const replacementTeacher = await get<{ id: number; name: string; role: string }>(
      `SELECT id, name, role FROM users WHERE id = $1`,
      [replacementTeacherId]
    );
    
    if (!replacementTeacher) {
      return NextResponse.json({ error: 'Викладача не знайдено' }, { status: 404 });
    }
    
    if (replacementTeacher.role !== 'teacher') {
      return NextResponse.json({ error: 'Обраний користувач не є викладачем' }, { status: 400 });
    }
    
    // Check if replacement teacher is the same as original
    if (replacementTeacherId === originalTeacherId) {
      return NextResponse.json({ error: 'Новий викладач співпадає з поточним' }, { status: 400 });
    }
    
    // Record the replacement in history table
    await run(
      `INSERT INTO lesson_teacher_replacements 
       (lesson_id, original_teacher_id, replacement_teacher_id, replaced_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [lessonId, originalTeacherId, replacementTeacherId, user.id, reason || null]
    );
    
    // Update the lesson with the replacement teacher
    await run(
      `UPDATE lessons SET teacher_id = $1, updated_at = NOW() WHERE id = $2`,
      [replacementTeacherId, lessonId]
    );
    
    // Get updated lesson with details
    const updatedLessonRaw = await get<Lesson & { group_title: string; course_title: string; teacher_name: string }>(
      `SELECT 
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        l.topic,
        l.status,
        l.created_by,
        l.teacher_id,
        g.title as group_title,
        c.title as course_title,
        COALESCE(u.name, g_teacher.name) as teacher_name
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
      teacherId: updatedLessonRaw.teacher_id || originalTeacherId,
      teacherName: updatedLessonRaw.teacher_name,
      originalTeacherId: originalTeacherId,
      isReplaced: true,
      startTime: updatedLessonRaw.start_datetime.split(' ')[1].substring(0, 5),
      endTime: updatedLessonRaw.end_datetime.split(' ')[1].substring(0, 5),
      status: updatedLessonRaw.status,
      topic: updatedLessonRaw.topic,
    } : null;
    
    return NextResponse.json({
      message: 'Викладача успішно замінено',
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error('Replace teacher error:', error);
    return NextResponse.json({ error: 'Не вдалося замінити викладача' }, { status: 500 });
  }
}

// DELETE /api/lessons/[id]/replace-teacher - Remove teacher replacement (restore original)
export async function DELETE(
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
    // Get original teacher from group
    const group = await get<{ teacher_id: number }>(
      `SELECT teacher_id FROM groups WHERE id = $1`,
      [lesson.group_id]
    );
    
    if (!group) {
      return NextResponse.json({ error: 'Групу не знайдено' }, { status: 404 });
    }
    
    // Remove the teacher replacement from the lesson
    await run(
      `UPDATE lessons SET teacher_id = NULL, updated_at = NOW() WHERE id = $1`,
      [lessonId]
    );
    
    // Delete replacement history
    await run(
      `DELETE FROM lesson_teacher_replacements WHERE lesson_id = $1`,
      [lessonId]
    );
    
    // Get original teacher name
    const originalTeacher = await get<{ id: number; name: string }>(
      `SELECT id, name FROM users WHERE id = $1`,
      [group.teacher_id]
    );
    
    // Get updated lesson with details
    const updatedLessonRaw = await get<Lesson & { group_title: string; course_title: string; teacher_name: string }>(
      `SELECT 
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        l.topic,
        l.status,
        l.created_by,
        l.teacher_id,
        g.title as group_title,
        c.title as course_title,
        g_teacher.name as teacher_name
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
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
      teacherId: group.teacher_id,
      teacherName: originalTeacher?.name || '',
      originalTeacherId: group.teacher_id,
      isReplaced: false,
      startTime: updatedLessonRaw.start_datetime.split(' ')[1].substring(0, 5),
      endTime: updatedLessonRaw.end_datetime.split(' ')[1].substring(0, 5),
      status: updatedLessonRaw.status,
      topic: updatedLessonRaw.topic,
    } : null;
    
    return NextResponse.json({
      message: 'Заміну викладача скасовано',
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error('Remove teacher replacement error:', error);
    return NextResponse.json({ error: 'Не вдалося скасувати заміну викладача' }, { status: 500 });
  }
}
