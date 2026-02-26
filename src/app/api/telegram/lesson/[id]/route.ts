import { NextRequest, NextResponse } from 'next/server';
import { get, all, run } from '@/db';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  topic: string | null;
  notes: string | null;
  status: string;
  topic_set_by: number | null;
  topic_set_at: string | null;
  notes_set_by: number | null;
  notes_set_at: string | null;
}

// Verify Telegram user from initData
async function verifyTelegramUser(initData: string): Promise<{ id: number; name: string } | null> {
  if (!initData) {
    console.log('[Telegram Verify] No initData provided');
    return null;
  }
  
  try {
    console.log('[Telegram Verify] initData:', initData.substring(0, 100));
    // Parse initData (format: key1=value1&key2=value2&...)
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    console.log('[Telegram Verify] userJson:', userJson);
    if (!userJson) {
      console.log('[Telegram Verify] No user in initData');
      return null;
    }
    
    const user = JSON.parse(decodeURIComponent(userJson));
    if (!user || !user.id) {
      console.log('[Telegram Verify] Invalid user data');
      return null;
    }
    
    console.log('[Telegram Verify] User from initData:', user.id, user.first_name, user.last_name);
    
    // Find user by telegram_id
    const dbUser = await get<{ id: number; name: string }>(
      `SELECT id, name FROM users WHERE telegram_id = $1`,
      [user.id.toString()]
    );
    
    console.log('[Telegram Verify] DB User found:', dbUser);
    
    if (!dbUser) {
      // Try to find by name as fallback - search across all roles (teacher, admin, etc.)
      const userName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      console.log('[Telegram Verify] Trying to find user by name:', userName);
      
      // Try exact match first
      let dbUserByName = await get<{ id: number; name: string }>(
        `SELECT id, name FROM users WHERE name ILIKE $1 LIMIT 1`,
        [userName]
      );
      
      // If not found, try partial match (first name only)
      if (!dbUserByName && user.first_name) {
        dbUserByName = await get<{ id: number; name: string }>(
          `SELECT id, name FROM users WHERE name ILIKE $1 LIMIT 1`,
          [`%${user.first_name}%`]
        );
      }
      
      if (dbUserByName) {
        console.log('[Telegram Verify] Found user by name, updating telegram_id');
        // Update the user's telegram_id
        await run(
          `UPDATE users SET telegram_id = $1 WHERE id = $2`,
          [user.id.toString(), dbUserByName.id]
        );
        console.log('[Telegram Verify] Updated telegram_id for user:', dbUserByName.id);
        return dbUserByName;
      }
      
      console.log('[Telegram Verify] User not found in database');
      return null;
    }
    
    return dbUser;
  } catch (error) {
    console.error('Error verifying Telegram user:', error);
    return null;
  }
}

// GET /api/telegram/lesson/[id] - Get lesson for Telegram WebApp
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Parse lessonId - support both numeric id and public_id (LSN-XXXXXXXX)
  console.log('[Telegram Lesson] Raw params.id:', JSON.stringify(params.id));
  const rawId = params.id;
  let lesson;
  
  // Try to parse as numeric id first
  const numericId = parseInt(rawId, 10);
  if (!isNaN(numericId)) {
    console.log('[Telegram Lesson] Trying to find lesson by numeric id:', numericId);
    lesson = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null }>(
      `SELECT 
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        l.topic,
        l.notes,
        l.status,
        l.created_by,
        l.teacher_id,
        l.topic_set_by,
        l.topic_set_at,
        l.notes_set_by,
        l.notes_set_at,
        u.name as teacher_name,
        g.title as group_title,
        g.teacher_id as original_teacher_id,
        g.course_id as course_id,
        c.title as course_title,
        CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced,
        topic_user.name as topic_set_by_name,
        notes_user.name as notes_set_by_name
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users topic_user ON l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by = notes_user.id
      WHERE l.id = $1`,
      [numericId]
    );
  }
  
  // If not found by numeric id, try to find by public_id
  if (!lesson && rawId.includes('LSN-')) {
    console.log('[Telegram Lesson] Trying to find lesson by public_id:', rawId);
    lesson = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null }>(
      `SELECT 
        l.id,
        l.group_id,
        l.lesson_date,
        l.start_datetime,
        l.end_datetime,
        l.topic,
        l.notes,
        l.status,
        l.created_by,
        l.teacher_id,
        l.topic_set_by,
        l.topic_set_at,
        l.notes_set_by,
        l.notes_set_at,
        u.name as teacher_name,
        g.title as group_title,
        g.teacher_id as original_teacher_id,
        g.course_id as course_id,
        c.title as course_title,
        CASE WHEN l.teacher_id IS NOT NULL THEN TRUE ELSE FALSE END as is_replaced,
        topic_user.name as topic_set_by_name,
        notes_user.name as notes_set_by_name
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users topic_user ON l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by = notes_user.id
      WHERE l.public_id = $1`,
      [rawId]
    );
  }
  
  if (!lesson) {
    console.error('[Telegram Lesson] Lesson not found by any identifier:', rawId);
    const lessonsCount = await get<{ count: number }>(`SELECT COUNT(*) as count FROM lessons`);
    const allLessons = await all<{ id: number; public_id: string; group_id: number; lesson_date: string }>(`SELECT id, public_id, group_id, lesson_date FROM lessons LIMIT 10`);
    console.error('[Telegram Lesson] Lessons count:', lessonsCount?.count);
    console.error('[Telegram Lesson] First 10 lessons:', allLessons);
    return NextResponse.json({ error: 'Заняття не знайдено', debug: { searchedId: rawId, lessonsCount: lessonsCount?.count, allLessons } }, { status: 404 });
  }
  
  // Verify Telegram user (skip verification if initData is empty for debugging purposes)
  const initData = request.nextUrl.searchParams.get('initData') || '';
  let telegramUser = null;
  
  if (initData) {
    telegramUser = await verifyTelegramUser(initData);
  }
  
  // Allow access without Telegram authentication for debugging
  // Note: In production, you might want to restrict this
  console.log('[Telegram Lesson] User verification:', telegramUser ? 'Success' : 'Skipped (no initData)');
  
  if (telegramUser) {
    console.log('[Telegram Lesson] Authorized user:', telegramUser.id, telegramUser.name);
  }
  
  console.log('[Telegram Lesson] Found lesson:', lesson.group_title, lesson.course_title);
  
  // Format datetime
  const formatDateTime = (date: any) => {
    if (!date) return '';
    const dateStr = typeof date === 'string' ? date : new Date(date).toISOString();
    return dateStr.split(' ')[1]?.substring(0, 5) || '';
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  const formatTimestamp = (timestamp: string | null): string | null => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const transformedLesson = {
    id: lesson.id,
    groupId: lesson.group_id,
    groupTitle: lesson.group_title,
    courseTitle: lesson.course_title,
    courseId: lesson.course_id,
    teacherId: lesson.teacher_id || lesson.original_teacher_id || null,
    teacherName: lesson.teacher_name || (lesson.original_teacher_id ? 'Викладач групи' : 'Немає викладача'),
    originalTeacherId: lesson.original_teacher_id || null,
    isReplaced: lesson.is_replaced,
    startTime: formatDateTime(lesson.start_datetime),
    endTime: formatDateTime(lesson.end_datetime),
    lessonDate: formatDate(lesson.lesson_date),
    status: lesson.status,
    topic: lesson.topic,
    notes: lesson.notes,
    topicSetBy: lesson.topic_set_by_name,
    topicSetAt: formatTimestamp(lesson.topic_set_at),
    notesSetBy: lesson.notes_set_by_name,
    notesSetAt: formatTimestamp(lesson.notes_set_at),
  };

  return NextResponse.json({ lesson: transformedLesson });
}

// PATCH /api/telegram/lesson/[id] - Update lesson from Telegram WebApp
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lessonId = parseInt(params.id, 10);
  
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }
  
  // Verify Telegram user (skip verification if initData is empty for debugging purposes)
  const initData = request.headers.get('x-telegram-init-data') || '';
  let telegramUser = null;
  
  if (initData) {
    telegramUser = await verifyTelegramUser(initData);
  }
  
  // Note: In production, you might want to restrict this
  console.log('[Telegram Lesson PATCH] User verification:', telegramUser ? 'Success' : 'Skipped (no initData)');
  
  // Check if lesson exists
  const lesson = await get<Lesson>(
    `SELECT * FROM lessons WHERE id = $1`,
    [lessonId]
  );
  
  if (!lesson) {
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }
  
  try {
    const body = await request.json();
    const { topic, notes } = body;
    
    const updates: string[] = ['updated_at = NOW()'];
    const queryParams: (string | number)[] = [];
    
    if (topic !== undefined) {
      updates.push(`topic = ${queryParams.length + 1}`);
      queryParams.push(topic);
      // Always set topic_set_by and topic_set_at (even if telegramUser is null, we track it)
      if (telegramUser) {
        updates.push(`topic_set_by = ${queryParams.length + 1}`);
        queryParams.push(telegramUser.id);
      } else {
        updates.push(`topic_set_by = NULL`);
      }
      updates.push(`topic_set_at = NOW()`);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = ${queryParams.length + 1}`);
      queryParams.push(notes);
      // Always set notes_set_by and notes_set_at (even if telegramUser is null, we track it)
      if (telegramUser) {
        updates.push(`notes_set_by = ${queryParams.length + 1}`);
        queryParams.push(telegramUser.id);
      } else {
        updates.push(`notes_set_by = NULL`);
      }
      updates.push(`notes_set_at = NOW()`);
    }
    
    queryParams.push(lessonId);
    
    const sql = `UPDATE lessons SET ${updates.join(', ')} WHERE id = ${queryParams.length}`;
    await run(sql, queryParams);
    
    // Get updated lesson with details
    const updatedLessonRaw = await get<Lesson & { topic_set_by_name: string | null; notes_set_by_name: string | null }>(
      `SELECT 
        l.*, 
        topic_user.name as topic_set_by_name, 
        notes_user.name as notes_set_by_name
      FROM lessons l
      LEFT JOIN users topic_user ON l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by = notes_user.id
      WHERE l.id = $1`,
      [lessonId]
    );
    
    // Transform to camelCase format
    const formatTimestamp = (timestamp: string | null): string | null => {
      if (!timestamp) return null;
      const date = new Date(timestamp);
      return date.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    const updatedLesson = updatedLessonRaw ? {
      id: updatedLessonRaw.id,
      groupId: updatedLessonRaw.group_id,
      lessonDate: updatedLessonRaw.lesson_date,
      startTime: updatedLessonRaw.start_datetime?.split(' ')[1]?.substring(0, 5) || '',
      endTime: updatedLessonRaw.end_datetime?.split(' ')[1]?.substring(0, 5) || '',
      status: updatedLessonRaw.status,
      topic: updatedLessonRaw.topic,
      notes: updatedLessonRaw.notes,
      topicSetBy: updatedLessonRaw.topic_set_by_name,
      topicSetAt: formatTimestamp(updatedLessonRaw.topic_set_at),
      notesSetBy: updatedLessonRaw.notes_set_by_name,
      notesSetAt: formatTimestamp(updatedLessonRaw.notes_set_at),
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

