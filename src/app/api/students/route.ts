import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { getStudentsWithGroupCount, getStudents, createStudent, searchStudents, quickSearchStudents, getStudentsWithGroups, searchStudentsWithGroups } from '@/lib/students';
import { addStudentHistoryEntry } from '@/lib/student-history';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  fullNameRequired: "П.І.Б. обов'язкове",
  createFailed: 'Не вдалося створити учня',
};

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
  
  let students;
  
  // Check for limit param (for autocomplete/pagination)
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : null;
  
  if (search) {
    // Search with optional limit
    if (limit) {
      students = await quickSearchStudents(search, limit);
    } else if (withGroups) {
      students = await searchStudentsWithGroups(search, includeInactive);
    } else {
      students = await searchStudents(search, includeInactive);
    }
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
  
  return NextResponse.json({ students });
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
    
    // Serialize interested_courses array to JSON string
    const interestedCoursesJson = interested_courses ? JSON.stringify(interested_courses) : undefined;
    
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
      discount?.trim(),
      parent_relation?.trim(),
      parent2_name?.trim(),
      parent2_relation?.trim(),
      interestedCoursesJson,
      source?.trim()
    );
    
    await addStudentHistoryEntry(
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
