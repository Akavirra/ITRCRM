import { NextRequest, NextResponse } from 'next/server';
import { get, all, run } from '@/db';
import { formatDateTimeKyiv, formatDateKyiv, formatTimeKyiv } from '@/lib/date-utils';

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
    
    if (dbUser) {
      return dbUser;
    }
    
    // Try to find user by name - search across all roles (teacher, admin, etc.)
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
    
    // If still not found, try with last name
    if (!dbUserByName && user.last_name) {
      dbUserByName = await get<{ id: number; name: string }>(
        `SELECT id, name FROM users WHERE name ILIKE $1 LIMIT 1`,
        [`%${user.last_name}%`]
      );
    }
    
    if (dbUserByName) {
      console.log('[Telegram Verify] Found user by name, updating telegram_id');
      // Update the user's telegram_id for future use
      await run(
        `UPDATE users SET telegram_id = $1 WHERE id = $2`,
        [user.id.toString(), dbUserByName.id]
      );
      console.log('[Telegram Verify] Updated telegram_id for user:', dbUserByName.id);
      return dbUserByName;
    }
    
    console.log('[Telegram Verify] User not found in database');
    return null;
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
    lesson = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null }>(
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
        CASE 
          WHEN l.topic_set_by < 0 THEN 'Telegram User'
          ELSE topic_user.name 
        END as topic_set_by_name,
        CASE 
          WHEN l.notes_set_by < 0 THEN 'Telegram User'
          ELSE notes_user.name 
        END as notes_set_by_name,
        CASE 
          WHEN l.topic_set_by < 0 THEN CAST((-l.topic_set_by) AS TEXT)
          ELSE topic_user.telegram_id 
        END as topic_set_by_telegram_id,
        CASE 
          WHEN l.notes_set_by < 0 THEN CAST((-l.notes_set_by) AS TEXT)
          ELSE notes_user.telegram_id 
        END as notes_set_by_telegram_id
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users g_teacher ON g.teacher_id = g_teacher.id
      LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
      WHERE l.id = $1`,
      [numericId]
    );
  }
  
  // If not found by numeric id, try to find by public_id
  if (!lesson && rawId.includes('LSN-')) {
    console.log('[Telegram Lesson] Trying to find lesson by public_id:', rawId);
    lesson = await get<Lesson & { group_title: string; course_title: string; course_id: number; teacher_id: number | null; teacher_name: string | null; original_teacher_id: number | null; is_replaced: boolean; topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null }>(
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
        CASE 
          WHEN l.topic_set_by < 0 THEN 'Telegram User'
          ELSE topic_user.name 
        END as topic_set_by_name,
        CASE 
          WHEN l.notes_set_by < 0 THEN 'Telegram User'
          ELSE notes_user.name 
        END as notes_set_by_name,
        CASE 
          WHEN l.topic_set_by < 0 THEN CAST((-l.topic_set_by) AS TEXT)
          ELSE topic_user.telegram_id 
        END as topic_set_by_telegram_id,
        CASE 
          WHEN l.notes_set_by < 0 THEN CAST((-l.notes_set_by) AS TEXT)
          ELSE notes_user.telegram_id 
        END as notes_set_by_telegram_id
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      JOIN courses c ON g.course_id = c.id
      LEFT JOIN users u ON l.teacher_id = u.id
      LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
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
  console.log('[Telegram Lesson] initData received:', initData ? 'Yes' : 'No');
  if (initData) {
    console.log('[Telegram Lesson] initData preview:', initData.substring(0, 100));
  }
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
    startTime: formatTimeKyiv(lesson.start_datetime),
    endTime: formatTimeKyiv(lesson.end_datetime),
    lessonDate: formatDateKyiv(lesson.lesson_date),
    status: lesson.status,
    topic: lesson.topic,
    notes: lesson.notes,
    topicSetBy: lesson.topic_set_by_name,
    topicSetAt: formatDateTimeKyiv(lesson.topic_set_at),
    topicSetByTelegramId: lesson.topic_set_by_telegram_id || null,
    notesSetBy: lesson.notes_set_by_name,
    notesSetAt: formatDateTimeKyiv(lesson.notes_set_at),
    notesSetByTelegramId: lesson.notes_set_by_telegram_id || null,
  };

  return NextResponse.json({ lesson: transformedLesson });
}

// PATCH /api/telegram/lesson/[id] - Update lesson from Telegram WebApp
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Parse lessonId - support both numeric id and public_id (LSN-XXXXXXXX)
  const rawId = params.id;
  let lesson: Lesson | null = null;
  
  // Try to parse as numeric id first
  const numericId = parseInt(rawId, 10);
  if (!isNaN(numericId)) {
    console.log('[Telegram Lesson PATCH] Trying to find lesson by numeric id:', numericId);
    lesson = (await get<Lesson>(
      `SELECT * FROM lessons WHERE id = $1`,
      [numericId]
    )) || null;
  }
  
  // If not found by numeric id, try to find by public_id
  if (!lesson && rawId.includes('LSN-')) {
    console.log('[Telegram Lesson PATCH] Trying to find lesson by public_id:', rawId);
    lesson = (await get<Lesson>(
      `SELECT * FROM lessons WHERE public_id = $1`,
      [rawId]
    )) || null;
  }
  
  if (!lesson) {
    console.error('[Telegram Lesson PATCH] Lesson not found by any identifier:', rawId);
    return NextResponse.json({ error: 'Заняття не знайдено' }, { status: 404 });
  }
  
  // Verify Telegram user (skip verification if initData is empty for debugging purposes)
  const initData = request.headers.get('x-telegram-init-data') || '';
  console.log('[Telegram Lesson PATCH] initData received:', initData ? 'YES (' + initData.length + ' chars)' : 'NO');
  let telegramUser = null;
  
  if (initData) {
    telegramUser = await verifyTelegramUser(initData);
  }
  
  // Note: In production, you might want to restrict this
  console.log('[Telegram Lesson PATCH] User verification result:', telegramUser ? `Found: ${telegramUser.name} (id: ${telegramUser.id})` : 'Not found');
  
  try {
    const body = await request.json();
    const { topic, notes } = body;
    
    console.log('[Telegram Lesson PATCH] Received body:', JSON.stringify(body));
    
    const updates: string[] = ['updated_at = NOW()'];
    const queryParams: (string | number | null)[] = [];
    
    if (topic !== undefined) {
      // Convert empty string to null to avoid PostgreSQL type inference issues
      const topicValue = topic === '' ? null : topic;
      updates.push(`topic = $${queryParams.length + 1}::text`);
      queryParams.push(topicValue);
      
      // Always track who set topic
      if (telegramUser) {
        updates.push(`topic_set_by = $${queryParams.length + 1}`);
        queryParams.push(telegramUser.id);
      } else {
        // Store negative telegram_id to indicate Telegram user that wasn't found in DB
        console.log('[Telegram Lesson] telegramUser is null, trying to parse initData');
        const user = JSON.parse(decodeURIComponent(new URLSearchParams(initData).get('user') || '{}'));
        console.log('[Telegram Lesson] Parsed user from initData:', user);
        if (user.id) {
          console.log('[Telegram Lesson] User ID found:', user.id);
          updates.push(`topic_set_by = $${queryParams.length + 1}`);
          queryParams.push(-user.id); // Store as negative to distinguish from regular user IDs
          
          // Store full Telegram user info in JSON field
          updates.push(`telegram_user_info = $${queryParams.length + 1}`);
          const telegramUserInfo = {
            telegram_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username
          };
          queryParams.push(JSON.stringify(telegramUserInfo));
          console.log('[Telegram Lesson] Storing telegram user info:', telegramUserInfo);
        } else {
          console.log('[Telegram Lesson] No user ID found in parsed data');
        }
      }
      updates.push(`topic_set_at = NOW()`);
    }
    
    if (notes !== undefined) {
      // Convert empty string to null to avoid PostgreSQL type inference issues
      const notesValue = notes === '' ? null : notes;
      updates.push(`notes = $${queryParams.length + 1}::text`);
      queryParams.push(notesValue);
      
      // Always track who set notes
      if (telegramUser) {
        updates.push(`notes_set_by = $${queryParams.length + 1}`);
        queryParams.push(telegramUser.id);
      } else {
        // Store negative telegram_id to indicate Telegram user that wasn't found in DB
        console.log('[Telegram Lesson] telegramUser is null for notes, trying to parse initData');
        const user = JSON.parse(decodeURIComponent(new URLSearchParams(initData).get('user') || '{}'));
        console.log('[Telegram Lesson] Parsed user from initData for notes:', user);
        if (user.id) {
          console.log('[Telegram Lesson] User ID found for notes:', user.id);
          updates.push(`notes_set_by = $${queryParams.length + 1}`);
          queryParams.push(-user.id); // Store as negative to distinguish from regular user IDs
          
          // Store full Telegram user info in JSON field
          updates.push(`telegram_user_info = $${queryParams.length + 1}`);
          const telegramUserInfo = {
            telegram_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username
          };
          queryParams.push(JSON.stringify(telegramUserInfo));
          console.log('[Telegram Lesson] Storing telegram user info for notes:', telegramUserInfo);
        } else {
          console.log('[Telegram Lesson] No user ID found in parsed data for notes');
        }
      }
      updates.push(`notes_set_at = NOW()`);
    }
    
    queryParams.push(lesson.id);
    
    const sql = `UPDATE lessons SET ${updates.join(', ')} WHERE id = $${queryParams.length}`;
    await run(sql, queryParams);
    
    // Get updated lesson with details
    const updatedLessonRaw = await get<Lesson & { topic_set_by_name: string | null; notes_set_by_name: string | null; topic_set_by_telegram_id: string | null; notes_set_by_telegram_id: string | null }>(
      `SELECT 
        l.*, 
        CASE 
          WHEN l.topic_set_by < 0 THEN 'Telegram User'
          ELSE topic_user.name 
        END as topic_set_by_name, 
        CASE 
          WHEN l.notes_set_by < 0 THEN 'Telegram User'
          ELSE notes_user.name 
        END as notes_set_by_name,
        CASE 
          WHEN l.topic_set_by < 0 THEN CAST((-l.topic_set_by) AS TEXT)
          ELSE topic_user.telegram_id 
        END as topic_set_by_telegram_id,
        CASE 
          WHEN l.notes_set_by < 0 THEN CAST((-l.notes_set_by) AS TEXT)
          ELSE notes_user.telegram_id 
        END as notes_set_by_telegram_id
      FROM lessons l
      LEFT JOIN users topic_user ON l.topic_set_by > 0 AND l.topic_set_by = topic_user.id
      LEFT JOIN users notes_user ON l.notes_set_by > 0 AND l.notes_set_by = notes_user.id
      WHERE l.id = $1`,
      [lesson.id]
    );
    
     const updatedLesson = updatedLessonRaw ? {
       id: updatedLessonRaw.id,
       groupId: updatedLessonRaw.group_id,
       lessonDate: formatDateKyiv(updatedLessonRaw.lesson_date),
       startTime: formatTimeKyiv(updatedLessonRaw.start_datetime),
       endTime: formatTimeKyiv(updatedLessonRaw.end_datetime),
       status: updatedLessonRaw.status,
       topic: updatedLessonRaw.topic,
       notes: updatedLessonRaw.notes,
       topicSetBy: updatedLessonRaw.topic_set_by_name,
       topicSetAt: formatDateTimeKyiv(updatedLessonRaw.topic_set_at),
       topicSetByTelegramId: updatedLessonRaw.topic_set_by_telegram_id,
       notesSetBy: updatedLessonRaw.notes_set_by_name,
       notesSetAt: formatDateTimeKyiv(updatedLessonRaw.notes_set_at),
       notesSetByTelegramId: updatedLessonRaw.notes_set_by_telegram_id,
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
