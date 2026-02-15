import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, notFound, checkGroupAccess } from '@/lib/api-utils';
import { cancelLesson, updateLessonTopic, markLessonDone } from '@/lib/lessons';
import { get } from '@/db';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidLessonId: 'Невірний ID заняття',
  lessonNotFound: 'Заняття не знайдено',
  updateFailed: 'Не вдалося оновити заняття',
};

// GET /api/lessons/[id] - Get lesson by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const lessonId = parseInt(params.id, 10);
  
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidLessonId }, { status: 400 });
  }
  
  const lesson = get<any>(`SELECT l.*, g.title as group_title, g.teacher_id FROM lessons l JOIN groups g ON l.group_id = g.id WHERE l.id = ?`, [lessonId]);
  
  if (!lesson) {
    return notFound(ERROR_MESSAGES.lessonNotFound);
  }
  
  // Check access
  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  return NextResponse.json({ lesson });
}

// PUT /api/lessons/[id] - Update lesson (topic, status)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const lessonId = parseInt(params.id, 10);
  
  if (isNaN(lessonId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidLessonId }, { status: 400 });
  }
  
  const lesson = get<any>(`SELECT * FROM lessons WHERE id = ?`, [lessonId]);
  
  if (!lesson) {
    return notFound(ERROR_MESSAGES.lessonNotFound);
  }
  
  // Check access
  const hasAccess = await checkGroupAccess(user, lesson.group_id);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    const { topic, status } = body;
    
    if (topic !== undefined) {
      updateLessonTopic(lessonId, topic);
    }
    
    if (status === 'done') {
      markLessonDone(lessonId);
    } else if (status === 'canceled') {
      cancelLesson(lessonId);
    }
    
    return NextResponse.json({ message: 'Заняття успішно оновлено' });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}
