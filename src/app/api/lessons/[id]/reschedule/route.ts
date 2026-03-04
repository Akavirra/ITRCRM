import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { get, run } from '@/db';
import { parseISO, setHours, setMinutes, format, addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

interface Lesson {
  id: number;
  group_id: number;
  lesson_date: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  duration_minutes: number;
}

interface Group {
  id: number;
  start_time: string;
  duration_minutes: number;
}

// POST /api/lessons/[id]/reschedule - Reschedule a lesson
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
    `SELECT l.*, g.duration_minutes as duration_minutes 
     FROM lessons l 
     JOIN groups g ON l.group_id = g.id 
     WHERE l.id = $1`,
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
  
  try {
    const body = await request.json();
    const { newDate, newTime, keepDuration } = body;
    
    if (!newDate) {
      return NextResponse.json({ error: 'Вкажіть нову дату' }, { status: 400 });
    }
    
    const newDateObj = parseISO(newDate);
    const newTimeStr = newTime || lesson.start_datetime.split(' ')[1].substring(0, 5);
    const [hours, minutes] = newTimeStr.split(':').map(Number);
    
    // Calculate new start and end datetime
    const startDateTime = setMinutes(setHours(newDateObj, hours), minutes);
    const duration = keepDuration ? lesson.duration_minutes : 90;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
    
    await run(
      `UPDATE lessons SET 
        lesson_date = $1, 
        start_datetime = $2, 
        end_datetime = $3, 
        status = 'scheduled',
        updated_at = NOW() 
      WHERE id = $4`,
      [
        format(newDateObj, 'yyyy-MM-dd'),
        format(startDateTime, 'yyyy-MM-dd HH:mm:ss'),
        format(endDateTime, 'yyyy-MM-dd HH:mm:ss'),
        lessonId
      ]
    );
    
    const updatedLesson = await get<Lesson>(`SELECT * FROM lessons WHERE id = $1`, [lessonId]);
    
    return NextResponse.json({
      message: 'Заняття перенесено',
      lesson: updatedLesson,
    });
  } catch (error) {
    console.error('Reschedule lesson error:', error);
    return NextResponse.json({ error: 'Не вдалося перенести заняття' }, { status: 500 });
  }
}
