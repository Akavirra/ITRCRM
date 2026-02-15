import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getCourseById, updateCourse, archiveCourse, restoreCourse, deleteCourse } from '@/lib/courses';
import { verifyPassword } from '@/lib/auth';
import { get } from '@/db';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidCourseId: 'Невірний ID курсу',
  courseNotFound: 'Курс не знайдено',
  titleRequired: "Назва обов'язкова",
  titleMinLength: 'Назва повинна містити мінімум 2 символи',
  ageLabelRequired: "Вікова мітка обов'язкова",
  ageLabelInvalid: 'Вікова мітка повинна мати формат: число+ (наприклад: 6+, 18+)',
  durationRequired: "Тривалість обов'язкова",
  durationInvalid: 'Тривалість повинна бути цілим числом від 1 до 36 місяців',
  updateFailed: 'Не вдалося оновити курс',
  cannotDeleteWithGroups: 'Неможливо видалити курс: є пов\'язані групи/дані.',
  deleteFailed: 'Не вдалося видалити курс',
  passwordRequired: 'Пароль обов\'язковий для підтвердження видалення',
  invalidPassword: 'Неправильний пароль',
};

// Validation helpers
function validateAgeLabel(ageLabel: string): boolean {
  return /^\d{1,2}\+$/.test(ageLabel);
}

function validateDurationMonths(duration: number): boolean {
  return Number.isInteger(duration) && duration >= 1 && duration <= 36;
}

// GET /api/courses/[id] - Get course by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const courseId = parseInt(params.id, 10);
  
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }
  
  const course = getCourseById(courseId);
  
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  return NextResponse.json({ course });
}

// PUT /api/courses/[id] - Update course
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const courseId = parseInt(params.id, 10);
  
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }
  
  const existingCourse = getCourseById(courseId);
  
  if (!existingCourse) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  try {
    const body = await request.json();
    const { title, description, age_label, duration_months, program } = body;
    
    // Validate title
    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.titleRequired },
        { status: 400 }
      );
    }
    
    if (title.trim().length < 2) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.titleMinLength },
        { status: 400 }
      );
    }
    
    // Validate age_label
    if (!age_label || age_label.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.ageLabelRequired },
        { status: 400 }
      );
    }
    
    if (!validateAgeLabel(age_label.trim())) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.ageLabelInvalid },
        { status: 400 }
      );
    }
    
    // Validate duration_months
    if (duration_months === undefined || duration_months === null) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.durationRequired },
        { status: 400 }
      );
    }
    
    const duration = Number(duration_months);
    if (!validateDurationMonths(duration)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.durationInvalid },
        { status: 400 }
      );
    }
    
    updateCourse(
      courseId,
      title.trim(),
      description?.trim(),
      age_label.trim(),
      duration,
      program?.trim()
    );
    
    return NextResponse.json({ message: 'Курс успішно оновлено' });
  } catch (error) {
    console.error('Update course error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[id] - Delete course with password confirmation (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return unauthorized();
    }
    
    if (!isAdmin(user)) {
      return forbidden();
    }
    
    const courseId = parseInt(params.id, 10);
    
    if (isNaN(courseId)) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
    }
    
    const existingCourse = getCourseById(courseId);
    
    if (!existingCourse) {
      return notFound(ERROR_MESSAGES.courseNotFound);
    }
    
    // Parse request body for password confirmation
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: ERROR_MESSAGES.passwordRequired },
        { status: 400 }
      );
    }
    
    const { password } = body;
    
    // Validate password is provided
    if (!password) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.passwordRequired },
        { status: 400 }
      );
    }
    
    // Get user's password hash from database
    const userWithPassword = get<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = ?`,
      [user.id]
    );
    
    if (!userWithPassword) {
      return unauthorized();
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, userWithPassword.password_hash);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidPassword },
        { status: 401 }
      );
    }
    
    // Attempt to delete the course
    const deleted = deleteCourse(courseId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.cannotDeleteWithGroups },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete course error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.deleteFailed },
      { status: 500 }
    );
  }
}

// PATCH /api/courses/[id] - Restore course
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const courseId = parseInt(params.id, 10);
  
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }
  
  const existingCourse = getCourseById(courseId);
  
  if (!existingCourse) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  restoreCourse(courseId);
  
  return NextResponse.json({ message: 'Курс успішно відновлено' });
}
