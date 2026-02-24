import { NextRequest, NextResponse } from 'next/server';
import { run, get, all } from '@/db';
import { answerCallbackQuery, editMessageText } from '@/lib/telegram';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// POST /api/telegram/callback - Handle callback queries from Telegram inline buttons
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle Telegram callback query
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackData = callbackQuery.data;
      const message = callbackQuery.message;
      const user = callbackQuery.from;
      
      console.log('[Telegram Callback] Received:', callbackData);
      console.log('[Telegram Callback] User:', user.id);
      console.log('[Telegram Callback] Message:', message ? 'present' : 'missing');
      
      // Parse callback data: attendance_lessonId_studentId_status
      if (callbackData?.startsWith('attendance_')) {
        const parts = callbackData.split('_');
        if (parts.length >= 4) {
          const lessonId = parseInt(parts[1]);
          const studentId = parseInt(parts[2]);
          const status = parts[3]; // 'present' or 'absent'
          
          if (isNaN(lessonId) || isNaN(studentId)) {
            await answerCallbackQuery(callbackQuery.id, 'Невірні параметри');
            return NextResponse.json({ ok: true });
          }
          
          // Get the user from database (telegram_id)
          const dbUser = await get<{ id: number; name: string }>(
            `SELECT id, name FROM users WHERE telegram_id = $1`,
            [user.id.toString()]
          );
          
          if (!dbUser) {
            await answerCallbackQuery(callbackQuery.id, 'Ви не прив\'язані до системи. Зверніться до адміністратора.');
            return NextResponse.json({ ok: true });
          }
          
          // Set attendance
          await run(
            `INSERT INTO attendance (lesson_id, student_id, status, updated_at, updated_by)
             VALUES ($1, $2, $3, NOW(), $4)
             ON CONFLICT (lesson_id, student_id) DO UPDATE SET status = $3, updated_at = NOW(), updated_by = $4`,
            [lessonId, studentId, status, dbUser.id]
          );
          
          // Get student name for confirmation
          const student = await get<{ full_name: string }>(
            `SELECT full_name FROM students WHERE id = $1`,
            [studentId]
          );
          
          const statusText = status === 'present' ? '✅ Присутній' : '❌ Відсутній';
          await answerCallbackQuery(
            callbackQuery.id, 
            `${student?.full_name || 'Учень'} відзначений як ${statusText}`
          );
          
          // Update the message with new attendance status
          if (message) {
            // Get updated attendance list for this lesson
            const attendance = await all<{
              student_id: number;
              student_name: string;
              status: string | null;
            }>(
              `SELECT 
                s.id as student_id,
                s.full_name as student_name,
                a.status
              FROM student_groups sg
              JOIN students s ON sg.student_id = s.id
              LEFT JOIN attendance a ON a.lesson_id = $1 AND a.student_id = s.id
              WHERE sg.group_id = (
                SELECT group_id FROM lessons WHERE id = $1
              ) AND sg.is_active = TRUE
              ORDER BY s.full_name`,
              [lessonId]
            );
            
            // Build new message text
            let newText = message.text?.split('\n\n👥 Відмітьте присутність:')[0] || message.text || '';
            newText += '\n\n👥 <b>Відмітьте присутність:</b>\n';
            
            attendance.forEach((s, index) => {
              const mark = s.status === 'present' ? '✅' : s.status === 'absent' ? '❌' : '⬜';
              newText += `${index + 1}. ${mark} ${s.student_name}\n`;
            });
            
            // Try to edit the message (may fail if too old)
            await editMessageText(
              message.chat.id.toString(),
              message.message_id,
              newText,
              { parseMode: 'HTML' }
            );
          }
          
          return NextResponse.json({ ok: true });
        }
      }
      
      // Handle topic input callback
      if (callbackData?.startsWith('topic_')) {
        const parts = callbackData.split('_');
        if (parts.length >= 2) {
          const lessonId = parseInt(parts[1]);
          
          await answerCallbackQuery(
            callbackQuery.id, 
            'Введіть тему заняття у наступному повідомленні'
          );
          
          // Note: For force reply, we'd need to store state and handle the next message
          // This is a simplified version
          return NextResponse.json({ ok: true });
        }
      }
      
      // Handle notes input callback
      if (callbackData?.startsWith('notes_')) {
        const parts = callbackData.split('_');
        if (parts.length >= 2) {
          const lessonId = parseInt(parts[1]);
          
          await answerCallbackQuery(
            callbackQuery.id, 
            'Введіть нотатки у наступному повідомленні'
          );
          
          return NextResponse.json({ ok: true });
        }
      }
    }
    
    // Handle regular updates from Telegram (like messages)
    if (body.message) {
      const message = body.message;
      const text = message.text;
      const chatId = message.chat.id.toString();
      
      console.log('[Telegram Message] From:', message.from.id, 'Text:', text);
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('[Telegram Callback Error]', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

// GET handler for verification
export async function GET() {
  return NextResponse.json({ status: 'Telegram callback handler is running' });
}
