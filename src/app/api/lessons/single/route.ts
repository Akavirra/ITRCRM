import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { createSingleLesson, createIndividualGroup } from '@/lib/lessons';
import { get } from '@/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  missingRequiredFields: "Відсутні обов'язкові поля",
  invalidDate: 'Некоректна дата',
  invalidTime: 'Некоректний час',
  invalidDuration: 'Тривалість повинна бути числом від 1 до 480 хвилин',
  groupNotFound: 'Групу не знайдено',
  courseNotFound: 'Курс не знайдено',
  teacherNotFound: 'Викладача не знайдено',
  createFailed: 'Не вдалося створити заняття',
};

// Validation helpers
function validateDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function validateTime(timeStr: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeStr);
}

function validateDuration(duration: number): boolean {
  return Number.isInteger(duration) && duration >= 1 && duration <= 480;
}

// POST /api/lessons/single - Create a single lesson
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (user.role !== 'admin') {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    const { 
      lessonDate, 
      startTime, 
      durationMinutes, 
      courseId, 
      teacherId, 
      groupId, 
      studentIds 
    } = body;
    
    // Validate required fields
    if (!lessonDate || !startTime || !durationMinutes || !teacherId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingRequiredFields },
        { status: 400 }
      );
    }
    
    // Course is required when no group is selected
    if (!groupId && !studentIds?.length && !courseId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingRequiredFields },
        { status: 400 }
      );
    }
    
    // Validate date format
    if (!validateDate(lessonDate)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidDate },
        { status: 400 }
      );
    }
    
    // Validate time format
    if (!validateTime(startTime)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidTime },
        { status: 400 }
      );
    }
    
    // Validate duration
    if (!validateDuration(durationMinutes)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidDuration },
        { status: 400 }
      );
    }
    
    // Check course exists (only if provided)
    let course = null;
    if (courseId) {
      course = await get<{ id: number }>(
        'SELECT id FROM courses WHERE id = $1',
        [courseId]
      );
      if (!course) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.courseNotFound },
          { status: 404 }
        );
      }
    }
    
    // Check teacher exists
    const teacher = await get<{ id: number }>(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [teacherId, 'teacher']
    );
    if (!teacher) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.teacherNotFound },
        { status: 404 }
      );
    }
    
    let finalGroupId = groupId;
    
    // If no groupId but studentIds provided, create an individual group
    if (!groupId && studentIds && studentIds.length > 0) {
      // Create individual group title
      const groupTitle = `Індивідуальне - ${format(new Date(lessonDate), 'dd.MM.yyyy')}`;
      
      // Create the group
      const groupResult = await createIndividualGroup({
        title: groupTitle,
        courseId,
        teacherId,
        studentIds
      }, user.id);
      
      finalGroupId = groupResult.id;
    }
    
    // If still no group, we need either groupId or studentIds
    if (!finalGroupId) {
      return NextResponse.json(
        { error: 'Потрібно обрати групу або учнів' },
        { status: 400 }
      );
    }
    
    // Check group exists
    const group = await get<{ id: number }>(
      'SELECT id FROM groups WHERE id = $1',
      [finalGroupId]
    );
    if (!group) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.groupNotFound },
        { status: 404 }
      );
    }
    
    // Create the lesson
    const lesson = await createSingleLesson({
      groupId: finalGroupId,
      lessonDate,
      startTime,
      durationMinutes,
      teacherId
    }, user.id);
    
    return NextResponse.json({
      message: 'Заняття успішно створено',
      lessonId: lesson.id,
      publicId: lesson.publicId
    });
    
  } catch (error) {
    console.error('[Create Single Lesson] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : ERROR_MESSAGES.createFailed },
      { status: 500 }
    );
  }
}
