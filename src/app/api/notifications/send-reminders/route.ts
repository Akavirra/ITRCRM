import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { get, all } from '@/db';
import { sendMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

interface LessonData {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
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
      // Get lesson data with group, course, and teacher info
      const lesson = await get<LessonData>(
        `SELECT 
          l.id, l.group_id, l.lesson_date, l.start_datetime, l.end_datetime, l.status,
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
        [lessonId]
      );
      
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
      
      // Get active students for this group
      const students = await all<Student>(
        `SELECT s.name 
         FROM group_students gs
         JOIN students st ON gs.student_id = st.id
         JOIN users s ON st.user_id = s.id
         WHERE gs.group_id = $1 AND gs.status = 'active'`,
        [lesson.group_id]
      );
      
      // Format date and time
      const lessonDate = new Date(lesson.lesson_date).toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      const startTime = new Date(lesson.start_datetime).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const endTime = new Date(lesson.end_datetime).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Build message text
      let messageText = `📚 Нагадування про заняття сьогодні\n\n`;
      messageText += `Група: ${lesson.group_title}\n`;
      messageText += `Курс: ${lesson.course_title}\n`;
      messageText += `Час: ${startTime} - ${endTime}\n`;
      messageText += `Дата: ${lessonDate}\n\n`;
      messageText += `👥 Список учнів:\n`;
      
      if (students.length > 0) {
        students.forEach((student, index) => {
          messageText += `${index + 1}. ${student.name}\n`;
        });
      } else {
        messageText += `Немає активних учнів у групі\n`;
      }
      
      messageText += `\nВідмітьте присутність та вкажіть тему заняття у системі.`;
      
      // Send message
      const success = await sendMessage(teacherTelegramId, messageText);
      
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
