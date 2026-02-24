import { NextRequest, NextResponse } from 'next/server';
import { get, run } from '@/db';

// Verify Telegram user from initData
async function verifyTelegramUser(initData: string): Promise<{ id: number; name: string } | null> {
  if (!initData) return null;
  
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) return null;
    
    const user = JSON.parse(decodeURIComponent(userJson));
    if (!user || !user.id) return null;
    
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

// GET /api/telegram/lesson/[id]/attendance - Get attendance for lesson
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lessonId = parseInt(params.id, 10);
  
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: 'Невірний ID заняття' }, { status: 400 });
  }
  
  // Verify Telegram user (skip verification for GET requests to allow viewing form)
  const initData = request.nextUrl.searchParams.get('initData') || '';
  let telegramUser = null;
  
  if (initData) {
    telegramUser = await verifyTelegramUser(initData);
  }
  
  console.log('[Telegram Attendance] User verification:', telegramUser ? 'Success' : 'Skipped (no initData)');
  
  // Get students with their attendance
  const attendance = await all<{
    student_id: number;
    student_name: string;
    student_phone: string | null;
    status: 'present' | 'absent' | null;
  }>(
    `SELECT 
      s.id as student_id,
      s.full_name as student_name,
      s.phone as student_phone,
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
  
  return NextResponse.json({ attendance });
}

// POST /api/telegram/lesson/[id]/attendance - Set attendance
export async function POST(
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
  console.log('[Telegram Attendance POST] User verification:', telegramUser ? 'Success' : 'Skipped (no initData)');
  
  try {
    const body = await request.json();
    console.log('[Telegram Attendance POST] Incoming request body:', body);
    
    const { action, studentId, status } = body;
    
    if (action === 'set' && studentId && status) {
      console.log('[Telegram Attendance POST] Setting attendance for studentId:', studentId, 'status:', status);
      
      if (telegramUser) {
        await run(
          `INSERT INTO attendance (lesson_id, student_id, status, updated_at, updated_by)
           VALUES ($1, $2, $3, NOW(), $4)
           ON CONFLICT (lesson_id, student_id) DO UPDATE SET status = $3, updated_at = NOW(), updated_by = $4`,
          [lessonId, studentId, status, telegramUser.id]
        );
        console.log('[Telegram Attendance POST] Attendance updated with user info');
      } else {
        await run(
          `INSERT INTO attendance (lesson_id, student_id, status, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (lesson_id, student_id) DO UPDATE SET status = $3, updated_at = NOW()`,
          [lessonId, studentId, status]
        );
        console.log('[Telegram Attendance POST] Attendance updated without user info');
      }
      
      return NextResponse.json({ success: true });
    }
    
    console.error('[Telegram Attendance POST] Invalid action or parameters:', { action, studentId, status });
    return NextResponse.json({ error: 'Невірна дія' }, { status: 400 });
  } catch (error) {
    console.error('[Telegram Attendance POST] Error setting attendance:', error);
    // Send detailed error message to client for debugging
    const errorMessage = error instanceof Error ? error.message : 'Невідома помилка';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

import { all } from '@/db';
