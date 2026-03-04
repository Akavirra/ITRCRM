import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { getCoursesWithStats, getCourses, createCourse, searchCourses } from '@/lib/courses';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  titleRequired: "Назва обов'язкова",
  titleMinLength: 'Назва повинна містити мінімум 2 символи',
  ageMinRequired: "Вік дітей обов'язковий",
  ageMinInvalid: 'Вік дітей повинен бути цілим числом від 0 до 99',
  durationRequired: "Тривалість обов'язкова",
  durationInvalid: 'Тривалість повинна бути цілим числом від 1 до 36 місяців',
  createFailed: 'Не вдалося створити курс',
};

// Validation helpers
function validateAgeMin(ageMin: number): boolean {
  return Number.isInteger(ageMin) && ageMin >= 0 && ageMin <= 99;
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
    courses = await searchCourses(search, includeInactive);
  } else if (withStats) {
    courses = await getCoursesWithStats(includeInactive);
  } else {
    courses = await getCourses(includeInactive);
  }
  
  // DEBUG: тимчасове логування
  console.log('[API GET /api/courses] params:', { includeInactive, search, withStats }, '| courses count:', courses?.length, '| courses:', JSON.stringify(courses?.map((c: any) => ({ id: c.id, title: c.title, is_active: c.is_active }))).substring(0, 500));
  
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
    
    const result = await createCourse(
      title.trim(),
      description?.trim(),
      ageMinValue,
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
