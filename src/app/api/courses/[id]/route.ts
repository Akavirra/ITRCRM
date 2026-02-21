import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getCourseById, updateCourse, archiveCourse, restoreCourse, deleteCourse } from '@/lib/courses';
import { verifyPassword } from '@/lib/auth';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidCourseId: 'Невірний ID курсу',
  courseNotFound: 'Курс не знайдено',
  titleRequired: "Назва обов'язкова",
  titleMinLength: 'Назва повинна містити мінімум 2 символи',
  ageMinRequired: "Вік дітей обов'язковий",
  ageMinInvalid: 'Вік дітей повинен бути цілим числом від 0 до 99',
  durationRequired: "Тривалість обов'язкова",
  durationInvalid: 'Тривалість повинна бути цілим числом від 1 до 36 місяців',
  updateFailed: 'Не вдалося оновити курс',
  deleteFailed: 'Не вдалося видалити курс',
  passwordRequired: 'Пароль обов\'язковий для підтвердження видалення',
  invalidPassword: 'Неправильний пароль',
};

// Validation helpers
function validateAgeMin(ageMin: number): boolean {
  return Number.isInteger(ageMin) && ageMin >= 0 && ageMin <= 99;
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
  
  const course = await getCourseById(courseId);
  
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
  
  const existingCourse = await getCourseById(courseId);
  
  if (!existingCourse) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  try {
    const body = await request.json();
    const { title, description, age_min, duration_months, program } = body;
    
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
    
    // Validate age_min
    if (age_min === undefined || age_min === null) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.ageMinRequired },
        { status: 400 }
      );
    }
    
    const ageMinValue = Number(age_min);
    if (!validateAgeMin(ageMinValue)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.ageMinInvalid },
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
    
    await updateCourse(
      courseId,
      title.trim(),
      description?.trim(),
      ageMinValue,
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
    
    const existingCourse = await getCourseById(courseId);
    
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
    const userWithPassword = await get<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
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
    const deleted = await deleteCourse(courseId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.deleteFailed },
        { status: 500 }
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
  
  const existingCourse = await getCourseById(courseId);
  
  if (!existingCourse) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  await restoreCourse(courseId);
  
  return NextResponse.json({ message: 'Курс успішно відновлено' });
}
