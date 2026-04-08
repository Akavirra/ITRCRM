import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';
import { sendMessage } from '@/lib/telegram';
import { formatDateKyiv, formatTimeKyiv } from '@/lib/date-utils';
import { getTeacherAppVersionSeed } from '@/lib/teacher-app-version';

export const dynamic = 'force-dynamic';

interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: {
    url: string;
  };
}

interface LessonData {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  start_time_formatted: string | null;
  end_time_formatted: string | null;
  status: string;
  topic: string | null;
  notes: string | null;
  group_title: string;
  course_title: string;
  teacher_id: number;
  teacher_name: string;
  teacher_telegram_id: string | null;
  replacement_teacher_id: number | null;
  replacement_teacher_name: string | null;
  replacement_teacher_telegram_id: string | null;
}

interface Student {
  name: string;
}

// POST /api/notifications/send-reminders
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  // Only admin can send reminders
  if (user.role !== 'admin') {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    const { lessonIds } = body;
    
    if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
      return NextResponse.json(
        { error: 'Потрібно обрати хоча б одне заняття' },
        { status: 400 }
      );
    }
    
    const sent: Array<{ lessonId: number; teacherName: string; groupName: string }> = [];
    const skipped: Array<{ lessonId: number; reason: string }> = [];
    
    // Process each lesson
    for (const lessonId of lessonIds) {
      // Get lesson data with group, course, teacher info, and topic
      // Support both numeric id and public_id (LSN-XXXXXXXX)
      let lesson;
      const numericId = parseInt(lessonId, 10);
      if (!isNaN(numericId)) {
        // Try numeric id
        lesson = await get<LessonData>(
          `SELECT 
            l.id, l.group_id, l.lesson_date, l.start_datetime, l.end_datetime, l.status,
            TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time_formatted,
            TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time_formatted,
            l.topic, l.notes,
            g.title as group_title, c.title as course_title,
            g.teacher_id,
            u.name as teacher_name, u.telegram_id as teacher_telegram_id,
            ltr.replacement_teacher_id,
            ru.name as replacement_teacher_name, ru.telegram_id as replacement_teacher_telegram_id
          FROM lessons l
          JOIN groups g ON l.group_id = g.id
          JOIN courses c ON g.course_id = c.id
          JOIN users g_teacher ON g.teacher_id = g_teacher.id
          LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
          LEFT JOIN users u ON g.teacher_id = u.id
          LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
          WHERE l.id = $1`,
          [numericId]
        );
      }
      
      // If not found by numeric id, try public_id
      if (!lesson && typeof lessonId === 'string' && lessonId.includes('LSN-')) {
        lesson = await get<LessonData>(
          `SELECT 
            l.id, l.group_id, l.lesson_date, l.start_datetime, l.end_datetime, l.status,
            TO_CHAR(l.start_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as start_time_formatted,
            TO_CHAR(l.end_datetime AT TIME ZONE COALESCE(g.timezone, 'Europe/Kyiv'), 'HH24:MI') as end_time_formatted,
            l.topic, l.notes,
            g.title as group_title, c.title as course_title,
            g.teacher_id,
            u.name as teacher_name, u.telegram_id as teacher_telegram_id,
            ltr.replacement_teacher_id,
            ru.name as replacement_teacher_name, ru.telegram_id as replacement_teacher_telegram_id
          FROM lessons l
          JOIN groups g ON l.group_id = g.id
          JOIN courses c ON g.course_id = c.id
          JOIN users g_teacher ON g.teacher_id = g_teacher.id
          LEFT JOIN lesson_teacher_replacements ltr ON l.id = ltr.lesson_id
          LEFT JOIN users u ON g.teacher_id = u.id
          LEFT JOIN users ru ON ltr.replacement_teacher_id = ru.id
          WHERE l.public_id = $1`,
          [lessonId]
        );
      }
      
      if (!lesson) {
        skipped.push({ lessonId, reason: 'Заняття не знайдено' });
        continue;
      }
      
      if (lesson.status === 'canceled') {
        skipped.push({ lessonId, reason: 'Заняття скасовано' });
        continue;
      }
      
      // Determine which teacher to notify (replacement or original)
      const teacherId = lesson.replacement_teacher_id || lesson.teacher_id;
      const teacherName = lesson.replacement_teacher_name || lesson.teacher_name;
      const teacherTelegramId = lesson.replacement_teacher_telegram_id || lesson.teacher_telegram_id;
      
      if (!teacherTelegramId) {
        skipped.push({ 
          lessonId, 
          reason: `Telegram ID викладача (${teacherName}) не знайдено` 
        });
        continue;
      }
      
      // Format date and time - use proper timezone handling
      const lessonDate = formatDateKyiv(lesson.lesson_date);
      const startTime = lesson.start_time_formatted || formatTimeKyiv(lesson.start_datetime);
      
      // Build message with student count
      let messageText = `📚 <b>Нагадування про заняття</b>\n\n`;
      messageText += `<b>Час:</b> сьогодні о ${startTime}\n`;
      messageText += `<b>Група:</b> ${lesson.group_title}\n`;
      messageText += `<b>Курс:</b> ${lesson.course_title}\n\n`;
      
      // Get student count for the group
      const studentCount = await get<{ count: number }>(
        `SELECT COUNT(*) as count FROM student_groups sg 
         JOIN students s ON sg.student_id = s.id 
         WHERE sg.group_id = $1 AND sg.is_active = TRUE AND s.is_active = TRUE`,
        [lesson.group_id]
      );
      
      messageText += `👥 <b>Студентів:</b> ${studentCount?.count || 0}`;

      // Create inline keyboard with Mini App button
      const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
      const teacherAppVersion = `${getTeacherAppVersionSeed()}-${Date.now().toString(36)}`;
      const miniAppUrl = `${WEB_APP_URL}/tg-app?v=${encodeURIComponent(teacherAppVersion)}`;
      
      const keyboard: { inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>> } = {
        inline_keyboard: [
          [
            {
              text: '� Відкрити кабінет',
              web_app: { url: miniAppUrl }
            }
          ]
        ]
      };
      
      // Send message with inline keyboard
      const success = await sendMessage(teacherTelegramId, messageText, {
        parseMode: 'HTML',
        replyMarkup: keyboard
      });
      
      if (success) {
        sent.push({
          lessonId,
          teacherName,
          groupName: lesson.group_title
        });
      } else {
        skipped.push({
          lessonId,
          reason: `Не вдалося надіслати повідомлення викладачу ${teacherName}`
        });
      }
    }
    
    return NextResponse.json({
      sent,
      skipped,
      summary: {
        total: lessonIds.length,
        sentCount: sent.length,
        skippedCount: skipped.length
      }
    });
    
  } catch (error) {
    console.error('Failed to send reminders:', error);
    return NextResponse.json(
      { error: 'Помилка при надсиланні нагадувань' },
      { status: 500 }
    );
  }
}
