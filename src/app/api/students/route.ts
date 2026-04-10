import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { getStudentsWithGroupCount, getStudents, createStudent, searchStudents, quickSearchStudents, getStudentsWithGroups, searchStudentsWithGroups, listStudentsWithGroups, getStudentAgeOptions, getStudentSchoolOptions } from '@/lib/students';
import { safeAddStudentHistoryEntry } from '@/lib/student-history';
import { getOrSetServerCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  fullNameRequired: "П.І.Б. обов'язкове",
  invalidEmail: 'Невірний формат email',
  createFailed: 'Не вдалося створити учня',
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// SECURITY: public_id is always generated server-side.
// Any client-provided public_id is explicitly ignored to prevent:
// - ID prediction/enumeration attacks
// - Collisions with existing records
// - Format manipulation

// GET /api/students - List students
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const search = searchParams.get('search') || '';
  const withGroupCount = searchParams.get('withGroupCount') === 'true';
  const withGroups = searchParams.get('withGroups') === 'true';
  const ageOptionsOnly = searchParams.get('ageOptions') === 'true';
  const schoolOptionsOnly = searchParams.get('schoolOptions') === 'true';
  const autocompleteOnly = searchParams.get('autocomplete') === 'true';
  const courseIdParam = searchParams.get('courseId');
  const groupIdParam = searchParams.get('groupId');
  const agesParam = searchParams.get('ages');
  const sortByParam = searchParams.get('sortBy');
  const sortOrderParam = searchParams.get('sortOrder');
  
  if (ageOptionsOnly) {
    const ages = await getOrSetServerCache(
      `students:age-options:${includeInactive ? 'all' : 'active'}`,
      5 * 60 * 1000,
      () => getStudentAgeOptions(includeInactive)
    );
    return NextResponse.json({ ages });
  }

  if (schoolOptionsOnly) {
    const schools = await getOrSetServerCache(
      `students:school-options:${includeInactive ? 'all' : 'active'}`,
      5 * 60 * 1000,
      () => getStudentSchoolOptions(includeInactive)
    );
    return NextResponse.json({ schools });
  }

  if (autocompleteOnly) {
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 10;
    const students = search ? await quickSearchStudents(search, limit) : [];
    return NextResponse.json({ students });
  }

  let students;
  
  // Check for limit param (for autocomplete/pagination)
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : null;
  const pageParam = searchParams.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const offset = limit ? (page - 1) * limit : 0;
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : undefined;
  const groupId = groupIdParam ? parseInt(groupIdParam, 10) : undefined;
  const ages = agesParam
    ? agesParam.split(',').map((value) => parseInt(value, 10)).filter((value) => !Number.isNaN(value))
    : undefined;
  const sortBy = sortByParam === 'created_at' ? 'created_at' : 'name';
  const sortOrder = sortOrderParam === 'desc' ? 'desc' : 'asc';
  let total: number | undefined;
  
  if (search) {
    // Search with optional limit
    if (limit && !courseId && !groupId && !withGroups) {
      students = await quickSearchStudents(search, limit);
    } else if (withGroups || courseId || groupId || (ages && ages.length > 0) || limit) {
      const result = await listStudentsWithGroups({
        includeInactive,
        search,
        courseId,
        groupId,
        ages,
        sortBy,
        sortOrder,
        limit: limit || 48,
        offset,
      });
      students = result.students;
      total = result.total;
    } else {
      students = await searchStudents(search, includeInactive);
    }
  } else if (withGroups && limit) {
    const result = await listStudentsWithGroups({
      includeInactive,
      courseId,
      groupId,
      ages,
      sortBy,
      sortOrder,
      limit,
      offset,
    });
    students = result.students;
    total = result.total;
  } else if (withGroups && (courseId || groupId || (ages && ages.length > 0) || sortByParam || sortOrderParam)) {
    const result = await listStudentsWithGroups({
      includeInactive,
      courseId,
      groupId,
      ages,
      sortBy,
      sortOrder,
    });
    students = result.students;
    total = result.total;
  } else if (limit) {
    // Limit without search - get all students with limit
    students = await getStudents(includeInactive);
    if (students.length > limit) {
      students = students.slice(0, limit);
    }
  } else if (withGroups) {
    students = await getStudentsWithGroups(includeInactive);
  } else if (withGroupCount) {
    students = await getStudentsWithGroupCount(includeInactive);
  } else {
    students = await getStudents(includeInactive);
  }

  const response: Record<string, unknown> = { students };
  if (typeof total === 'number' && limit) {
    response.pagination = {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  } else if (typeof total === 'number') {
    response.pagination = {
      page: 1,
      limit: total,
      total,
      totalPages: 1,
    };
  }

  return NextResponse.json(response);
}

// POST /api/students - Create student
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
    // The createStudent function always generates a unique server-side public_id
    const { 
      full_name, 
      phone, 
      email,
      parent_name, 
      parent_phone, 
      notes,
      birth_date,
      school,
      discount,
      parent_relation,
      parent2_name,
      parent2_phone,
      parent2_relation,
      interested_courses,
      source,
      photo
    } = body;
    
    if (!full_name || full_name.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.fullNameRequired },
        { status: 400 }
      );
    }

    if (email && email.trim() && !isValidEmail(email)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidEmail },
        { status: 400 }
      );
    }

    const interestedCoursesValue = Array.isArray(interested_courses)
      ? interested_courses.map((course) => String(course).trim()).filter(Boolean).join(', ')
      : typeof interested_courses === 'string'
        ? interested_courses.trim() || undefined
        : undefined;
    
    const result = await createStudent(
      full_name.trim(),
      phone?.trim(),
      email?.trim(),
      parent_name?.trim(),
      parent_phone?.trim(),
      notes?.trim(),
      birth_date,
      photo || undefined,
      school?.trim(),
      discount != null ? parseInt(discount, 10) || 0 : undefined,
      parent_relation?.trim(),
      parent2_name?.trim(),
      parent2_phone?.trim(),
      parent2_relation?.trim(),
      interestedCoursesValue,
      source?.trim()
    );
    
    await safeAddStudentHistoryEntry(
      result.id,
      'created',
      `Учня ${full_name.trim()} створено в системі`,
      user.id,
      user.name
    );

    return NextResponse.json({
      id: result.id,
      public_id: result.public_id,
      message: 'Учня успішно створено',
    });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.createFailed },
      { status: 500 }
    );
  }
}
