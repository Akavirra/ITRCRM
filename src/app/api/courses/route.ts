import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { getCoursesWithStats, getCourses, createCourse, searchCourses } from '@/lib/courses';

// Ukrainian error messages
const ERROR_MESSAGES = {
  titleRequired: "Назва обов'язкова",
  titleMinLength: 'Назва повинна містити мінімум 2 символи',
  ageLabelRequired: "Вікова мітка обов'язкова",
  ageLabelInvalid: 'Вікова мітка повинна мати формат: число+ (наприклад: 6+, 18+)',
  durationRequired: "Тривалість обов'язкова",
  durationInvalid: 'Тривалість повинна бути цілим числом від 1 до 36 місяців',
  createFailed: 'Не вдалося створити курс',
};

// Validation helpers
function validateAgeLabel(ageLabel: string): boolean {
  return /^\d{1,2}\+$/.test(ageLabel);
}

function validateDurationMonths(duration: number): boolean {
  return Number.isInteger(duration) && duration >= 1 && duration <= 36;
}

// SECURITY: public_id is always generated server-side.
// Any client-provided public_id is explicitly ignored to prevent:
// - ID prediction/enumeration attacks
// - Collisions with existing records
// - Format manipulation

// GET /api/courses - List courses
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const search = searchParams.get('search') || '';
  const withStats = searchParams.get('withStats') === 'true';
  
  let courses;
  
  if (search) {
    courses = searchCourses(search, includeInactive);
  } else if (withStats) {
    courses = getCoursesWithStats(includeInactive);
  } else {
    courses = getCourses(includeInactive);
  }
  
  return NextResponse.json({ courses });
}

// POST /api/courses - Create course
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    // SECURITY: Explicitly ignore any client-provided public_id
    // The createCourse function always generates a unique server-side public_id
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
    
    const result = createCourse(
      title.trim(),
      description?.trim(),
      age_label.trim(),
      duration,
      program?.trim()
    );
    
    return NextResponse.json({
      id: result.id,
      public_id: result.public_id,
      message: 'Курс успішно створено',
    });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.createFailed },
      { status: 500 }
    );
  }
}
