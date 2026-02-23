import { NextRequest, NextResponse } from 'next/server';
import { run, get } from '@/db';
import { sendMessage, answerCallbackQuery } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// Telegram Webhook for handling callback queries
export async function POST(request: NextRequest) {
  try {
    console.log('[TelegramWebhook] Received request');
    const body = await request.json();
    console.log('[TelegramWebhook] Body:', JSON.stringify(body));
    
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
      
      if (action === 'set_topic') {
        // For now, just acknowledge - full implementation would require asking for input
        await answerCallbackQuery(
          callbackQuery.id, 
          `📝 Щоб вказати тему заняття, відкрийте систему та перейдіть до заняття ID: ${lessonId}`
        );
        return NextResponse.json({ ok: true });
      }
      
      if (action === 'set_notes') {
        await answerCallbackQuery(
          callbackQuery.id, 
          `📋 Щоб вказати нотатки, відкрийте систему та перейдіть до заняття ID: ${lessonId}`
        );
        return NextResponse.json({ ok: true });
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
