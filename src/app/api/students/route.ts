import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { getStudentsWithGroupCount, getStudents, createStudent, searchStudents } from '@/lib/students';

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
  
  let students;
  
  if (search) {
    students = searchStudents(search, includeInactive);
  } else if (withGroupCount) {
    students = getStudentsWithGroupCount(includeInactive);
  } else {
    students = getStudents(includeInactive);
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
    const { full_name, phone, parent_name, parent_phone, notes } = body;
    
    if (!full_name || full_name.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.fullNameRequired },
        { status: 400 }
      );
    }
    
    const result = createStudent(
      full_name.trim(),
      phone?.trim(),
      parent_name?.trim(),
      parent_phone?.trim(),
      notes?.trim()
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
