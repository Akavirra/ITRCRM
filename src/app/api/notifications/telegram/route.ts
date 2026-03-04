import { NextRequest, NextResponse } from 'next/server';
import { run, get } from '@/db';
import { sendMessage, answerCallbackQuery, sendMessageWithForceReply, editMessageText } from '@/lib/telegram';
import { formatDateTimeKyiv, formatTimeKyiv, formatDateKyiv } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

// In-memory storage for pending actions (in production, use Redis or DB)
const pendingActions = new Map<string, { lessonId: number; action: 'topic' | 'notes' | 'lesson'; timestamp: number; messageId?: number }>();

// Clean up old pending actions (older than 5 minutes)
function cleanupOldActions() {
  const now = Date.now();
  const entries = Array.from(pendingActions.entries());
  for (const [key, value] of entries) {
    if (now - value.timestamp > 5 * 60 * 1000) {
      pendingActions.delete(key);
    }
  }
}

// Telegram Webhook for handling callback queries
export async function POST(request: NextRequest) {
  try {
    console.log('[TelegramWebhook] Received request');
    const body = await request.json();
    console.log('[TelegramWebhook] Body:', JSON.stringify(body));
    
    cleanupOldActions();
    
    // Handle callback query (button click)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackData = callbackQuery.data;
      const telegramId = callbackQuery.from.id.toString();
      const messageId = callbackQuery.message?.message_id;
      
      // Parse callback data
      // Format: action_lessonId_studentId_status (e.g., attendance_37_5_present)
      const parts = callbackData.split('_');
      const action = parts[0];
      const lessonId = parseInt(parts[1]);
      
      if (action === 'attendance') {
        const studentId = parseInt(parts[2]);
        const status = parts[3]; // 'present' or 'absent'
        
        // Get student name
        const student = await get<{ full_name: string }>(
          `SELECT full_name FROM students WHERE id = $1`,
          [studentId]
        );
        
        // Get user by telegram_id
        const user = await get<{ id: number }>(
          `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1`,
          [telegramId]
        );
        
        if (!user) {
          await answerCallbackQuery(callbackQuery.id, `❌ Помилка: користувача не знайдено в системі. Telegram ID: ${telegramId}`);
          return NextResponse.json({ ok: false, error: 'User not found' });
        }
        
        // Record attendance in database
        await run(
          `INSERT INTO attendance (lesson_id, student_id, status, updated_at, updated_by)
           VALUES ($1, $2, $3, NOW(), $4)
           ON CONFLICT (lesson_id, student_id) DO UPDATE SET status = $3, updated_at = NOW(), updated_by = $4`,
          [lessonId, studentId, status === 'present' ? 'present' : 'absent', user.id]
        );
        
        // Answer the callback query
        await answerCallbackQuery(callbackQuery.id, `✅ Відмічено: ${student?.full_name || 'Учень'} - ${status === 'present' ? 'Присутній' : 'Відсутній'}`);
        
        return NextResponse.json({ ok: true });
      }
      
      if (action === 'set/topic' || action === 'set') {
        // Handle both formats: set_topic_37 and set/topic/37
        // For set_topic_37 format: action='set', parts[1]='topic', parts[2]=lessonId
        // For set/topic format: action='set/topic', parts[1]=lessonId
        const actualLessonId = action === 'set' ? parseInt(parts[2]) : lessonId;
        const actualAction = action === 'set' ? parts[1] : 'topic';
        
        if (actualAction === 'topic') {
          // Request topic input from user
          await answerCallbackQuery(callbackQuery.id, '📝 Введіть тему заняття');
          await sendMessageWithForceReply(
            telegramId, 
            `📝 Введіть тему для заняття #${actualLessonId}:\n\n(Відповідь на це повідомлення)`,
            'Тема заняття...'
          );
          
          // Store pending action
          pendingActions.set(`${telegramId}_topic`, { lessonId: actualLessonId, action: 'topic', timestamp: Date.now() });
          
          return NextResponse.json({ ok: true });
        }
      }
      
      if (action === 'set/notes' || (action === 'set' && parts[1] === 'notes')) {
        // Handle both formats
        const actualLessonId = action === 'set' ? parseInt(parts[2]) : lessonId;
        
        // Request notes input from user
        await answerCallbackQuery(callbackQuery.id, '📋 Введіть нотатки');
        await sendMessageWithForceReply(
          telegramId, 
          `📋 Введіть нотатки для заняття #${actualLessonId}:\n\n(Відповідь на це повідомлення)`,
          'Нотатки...'
        );
        
        // Store pending action
        pendingActions.set(`${telegramId}_notes`, { lessonId: actualLessonId, action: 'notes', timestamp: Date.now() });
        
        return NextResponse.json({ ok: true });
      }
      
      // New unified handler for setting both topic and notes
      if (action === 'set' && parts[1] === 'lesson') {
        const actualLessonId = lessonId;
        
        // Request topic input from user (first step)
        await answerCallbackQuery(callbackQuery.id, '📝 Введіть тему заняття');
        await sendMessageWithForceReply(
          telegramId, 
          `📝 Введіть тему для заняття #${actualLessonId}:\n\n(Відповідь на це повідомлення)`,
          'Тема заняття...'
        );
        
        // Store pending action with messageId so we can update it later
        pendingActions.set(`${telegramId}_lesson`, { 
          lessonId: actualLessonId, 
          action: 'lesson', 
          timestamp: Date.now(),
          messageId: messageId 
        });
        
        return NextResponse.json({ ok: true });
      }
    }
    
    // Handle text messages (replies to force_reply)
    if (body.message && body.message.text && !body.message.text.startsWith('/')) {
      const telegramId = body.message.from.id.toString();
      const text = body.message.text;
      const replyToMessage = body.message.reply_to_message;
      
      // Check if this is a reply to our request
      if (replyToMessage && replyToMessage.from?.username === 'ITRobotics23_bot') {
        // Check for pending topic action
        const topicAction = pendingActions.get(`${telegramId}_topic`);
        if (topicAction && replyToMessage.text?.includes('тему')) {
          // Get user by telegram_id
          const user = await get<{ id: number }>(
            `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1`,
            [telegramId]
          );
          
          // Save topic to database with who and when set it
          await run(
            `UPDATE lessons SET topic = $1, topic_set_by = $2, topic_set_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [text, user?.id || null, topicAction.lessonId]
          );
          
          pendingActions.delete(`${telegramId}_topic`);
          
          await sendMessage(telegramId, `✅ Тему збережено для заняття #${topicAction.lessonId}:\n\n${text}`);
          return NextResponse.json({ ok: true });
        }
        
        // Check for pending notes action
        const notesAction = pendingActions.get(`${telegramId}_notes`);
        if (notesAction && replyToMessage.text?.includes('нотатки')) {
          // Get user by telegram_id
          const user = await get<{ id: number }>(
            `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1`,
            [telegramId]
          );
          
          // Save notes to database with who and when set it
          await run(
            `UPDATE lessons SET notes = $1, notes_set_by = $2, notes_set_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [text, user?.id || null, notesAction.lessonId]
          );
          
          pendingActions.delete(`${telegramId}_notes`);
          
          await sendMessage(telegramId, `✅ Нотатки збережено для заняття #${notesAction.lessonId}:\n\n${text}`);
          return NextResponse.json({ ok: true });
        }
        
        // Check for pending lesson action (topic + notes)
        const lessonAction = pendingActions.get(`${telegramId}_lesson`);
        if (lessonAction && replyToMessage.text?.includes('тему')) {
          // First step: save topic and ask for notes
          const user = await get<{ id: number }>(
            `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1`,
            [telegramId]
          );
          
          // Save topic to database with who and when set it
          await run(
            `UPDATE lessons SET topic = $1, topic_set_by = $2, topic_set_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [text, user?.id || null, lessonAction.lessonId]
          );
          
          // Update pending action to notes step
          pendingActions.set(`${telegramId}_lesson_notes`, { 
            lessonId: lessonAction.lessonId, 
            action: 'notes', 
            timestamp: Date.now(),
            messageId: lessonAction.messageId
          });
          
          // Ask for notes
          await sendMessageWithForceReply(
            telegramId, 
            `📋 Тепер введіть нотатки для заняття #${lessonAction.lessonId}:\n\n(Відповідь на це повідомлення)`,
            'Нотатки...'
          );
          
          return NextResponse.json({ ok: true });
        }
        
        // Check for pending lesson notes action (second step)
        const lessonNotesAction = pendingActions.get(`${telegramId}_lesson_notes`);
        if (lessonNotesAction && replyToMessage.text?.includes('нотатки')) {
          const user = await get<{ id: number }>(
            `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1`,
            [telegramId]
          );
          
          // Save notes to database
          await run(
            `UPDATE lessons SET notes = $1, notes_set_by = $2, notes_set_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [text, user?.id || null, lessonNotesAction.lessonId]
          );
          
          pendingActions.delete(`${telegramId}_lesson_notes`);
          
          // Get updated lesson data
          const lesson = await get<{
            topic: string | null;
            notes: string | null;
            group_title: string;
            course_title: string;
            start_datetime: string;
            end_datetime: string;
          }>(
            `SELECT l.topic, l.notes, g.title as group_title, c.title as course_title, 
                    l.start_datetime, l.end_datetime
             FROM lessons l
             JOIN groups g ON l.group_id = g.id
             JOIN courses c ON g.course_id = c.id
             WHERE l.id = $1`,
            [lessonNotesAction.lessonId]
          );
          
          if (lesson && lessonNotesAction.messageId) {
            // Format the updated message - use proper timezone handling
            const startTime = formatTimeKyiv(lesson.start_datetime);
            const endTime = formatTimeKyiv(lesson.end_datetime);
            const lessonDate = formatDateKyiv(lesson.start_datetime);
            
            let updatedMessage = `<b>📚 Заняття оновлено</b>\n\n`;
            updatedMessage += `<b>Група:</b> ${lesson.group_title}\n`;
            updatedMessage += `<b>Курс:</b> ${lesson.course_title}\n`;
            updatedMessage += `<b>🕐 Час:</b> ${startTime} - ${endTime}\n`;
            updatedMessage += `<b>📅 Дата:</b> ${lessonDate}\n`;
            updatedMessage += `<b>📝 Тема:</b> ${lesson.topic || '<i>Не вказано</i>'}\n`;
            updatedMessage += `<b>📋 Нотатки:</b> ${lesson.notes || '<i>Не вказано</i>'}\n`;
            updatedMessage += `\n<i>Дані оновлено ✅</i>`;
            
            // Edit the original message with updated info
            await editMessageText(telegramId, lessonNotesAction.messageId, updatedMessage);
          }
          
          await sendMessage(telegramId, `✅ Тему та нотатки збережено для заняття #${lessonNotesAction.lessonId}`);
          return NextResponse.json({ ok: true });
        }
      }
    }
    
    // Handle /start command
    if (body.message && body.message.text === '/start') {
      const telegramId = body.message.from.id.toString();
      const name = body.message.from.first_name || 'Ви';
      
      await sendMessage(
        telegramId,
        `Вітаю, ${name}! 👋\n\nЦе бот ITRCRM для викладачів.\n\nВи отримуватимете нагадування про заняття тут.`
      );
      
      return NextResponse.json({ ok: true });
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
