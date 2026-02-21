import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  status: string;
}

// POST /api/lessons/[id]/cancel - Cancel a lesson
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
  
  // Check if already canceled
  if (lesson.status === 'canceled') {
    return NextResponse.json({ error: 'Заняття вже скасовано' }, { status: 400 });
  }
  
  try {
    const body = await request.json();
    const { reason } = body;
    
    await run(
      `UPDATE lessons SET status = 'canceled', topic = $1, updated_at = NOW() WHERE id = $2`,
      [reason || 'Скасовано', lessonId]
    );
    
    return NextResponse.json({
      message: 'Заняття скасовано',
    });
  } catch (error) {
    console.error('Cancel lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося скасувати заняття' }, { status: 500 });
  }
}
