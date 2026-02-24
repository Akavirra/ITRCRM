import { NextRequest, NextResponse } from 'next/server';
import { get } from '@/db';

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
  if (!initData) return null;
  
  try {
    // Parse initData (format: key1=value1&key2=value2&...)
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) return null;
    
    const user = JSON.parse(decodeURIComponent(userJson));
    if (!user || !user.id) return null;
    
    // Find user by telegram_id
    const dbUser = await get<{ id: number; name: string }>(
      `SELECT id, name FROM users WHERE telegram_id = $1`,
      [user.id.toString()]
    );
    
    return dbUser || null;
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
  // Parse lessonId
  const lessonId = parseInt(params.id, 10);
  
  console.log('[Telegram Lesson] params.id:', params.id, 'parsed lessonId:', lessonId);
  
  if (isNaN(lessonId)) {
    console.error('[Telegram Lesson] Invalid lesson ID:', params.id);
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }
  
  console.log('[Telegram Lesson] Loading lesson:', lessonId);
  
  // Verify Telegram user
  const initData = request.nextUrl.searchParams.get('initData') || '';
  const telegramUser = await verifyTelegramUser(initData);
  
  if (!telegramUser) {
    console.error('[Telegram Lesson] Unauthorized user, initData:', initData ? 'present' : 'empty');
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 401 });
  }
  
  console.log('[Telegram Lesson] Authorized user:', telegramUser.id, telegramUser.name);
  
  console.log('[Telegram Lesson] Querying database for lesson:', lessonId);
  
  // Get lesson with group, course and teacher details
  const lessonWithDetails = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null }>(
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
    [lessonId]
  );
  
  if (!lessonWithDetails) {
    console.error('[Telegram Lesson] Lesson not found in database:', lessonId);
    console.error('[Telegram Lesson] SQL query was executed, but returned no results');
    return NextResponse.json({ error: 'Заняття не знайдено', debug: { lessonId } }, { status: 404 });
  }
  
  console.log('[Telegram Lesson] Found lesson:', lessonWithDetails.group_title, lessonWithDetails.course_title);
  
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
  
  const transformedLesson = lessonWithDetails ? {
    id: lessonWithDetails.id,
    groupId: lessonWithDetails.group_id,
    groupTitle: lessonWithDetails.group_title,
    courseTitle: lessonWithDetails.course_title,
    courseId: lessonWithDetails.course_id,
    teacherId: lessonWithDetails.teacher_id || lessonWithDetails.original_teacher_id || null,
    teacherName: lessonWithDetails.teacher_name || (lessonWithDetails.original_teacher_id ? 'Викладач групи' : 'Немає викладача'),
    originalTeacherId: lessonWithDetails.original_teacher_id || null,
    isReplaced: lessonWithDetails.is_replaced,
    startTime: formatDateTime(lessonWithDetails.start_datetime),
    endTime: formatDateTime(lessonWithDetails.end_datetime),
    lessonDate: formatDate(lessonWithDetails.lesson_date),
    status: lessonWithDetails.status,
    topic: lessonWithDetails.topic,
    notes: lessonWithDetails.notes,
    topicSetBy: lessonWithDetails.topic_set_by_name,
    topicSetAt: formatTimestamp(lessonWithDetails.topic_set_at),
    notesSetBy: lessonWithDetails.notes_set_by_name,
    notesSetAt: formatTimestamp(lessonWithDetails.notes_set_at),
  } : null;

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
  
  // Verify Telegram user
  const initData = request.headers.get('x-telegram-init-data') || '';
  const telegramUser = await verifyTelegramUser(initData);
  
  if (!telegramUser) {
    return NextResponse.json({ error: 'Доступ заборонено' }, { status: 401 });
  }
  
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
      updates.push(`topic = $${queryParams.length + 1}`);
      queryParams.push(topic);
      updates.push(`topic_set_by = $${queryParams.length + 1}`);
      queryParams.push(telegramUser.id);
      updates.push(`topic_set_at = NOW()`);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = $${queryParams.length + 1}`);
      queryParams.push(notes);
      updates.push(`notes_set_by = $${queryParams.length + 1}`);
      queryParams.push(telegramUser.id);
      updates.push(`notes_set_at = NOW()`);
    }
    
    queryParams.push(lessonId);
    
    const sql = `UPDATE lessons SET ${updates.join(', ')} WHERE id = $${queryParams.length}`;
    await run(sql, queryParams);
    
    // Get updated lesson
    const updatedLesson = await get<Lesson>(
      `SELECT * FROM lessons WHERE id = $1`,
      [lessonId]
    );
    
    return NextResponse.json({
      message: 'Заняття оновлено',
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося оновити заняття' }, { status: 500 });
  }
}

import { run } from '@/db';
