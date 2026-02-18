import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getStudentById, getStudentWithGroups, updateStudent, archiveStudent, restoreStudent, deleteStudent, getStudentAttendanceHistory, getStudentPaymentHistory, getStudentActiveGroups, safeDeleteStudent, forceDeleteStudent } from '@/lib/students';
import { verifyPassword } from '@/lib/auth';
import { get } from '@/db';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidStudentId: 'Невірний ID учня',
  studentNotFound: 'Учня не знайдено',
  fullNameRequired: "П.І.Б. обов'язкове",
  updateFailed: 'Не вдалося оновити дані учня',
};

// GET /api/students/[id] - Get student by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const studentId = parseInt(params.id, 10);
  
  if (isNaN(studentId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidStudentId }, { status: 400 });
  }
  
  const { searchParams } = new URL(request.url);
  const withGroups = searchParams.get('withGroups') === 'true';
  const withAttendance = searchParams.get('withAttendance') === 'true';
  const withPayments = searchParams.get('withPayments') === 'true';
  
  const student = withGroups ? getStudentWithGroups(studentId) : getStudentById(studentId);
  
  if (!student) {
    return notFound(ERROR_MESSAGES.studentNotFound);
  }
  
  const response: any = { student };
  
  if (withAttendance) {
    response.attendanceHistory = getStudentAttendanceHistory(studentId);
  }
  
  if (withPayments) {
    response.paymentHistory = getStudentPaymentHistory(studentId);
  }
  
  return NextResponse.json(response);
}

// PUT /api/students/[id] - Update student
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
  
  const studentId = parseInt(params.id, 10);
  
  if (isNaN(studentId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidStudentId }, { status: 400 });
  }
  
  const existingStudent = getStudentById(studentId);
  
  if (!existingStudent) {
    return notFound(ERROR_MESSAGES.studentNotFound);
  }
  
  try {
    const body = await request.json();
    const { 
      full_name, 
      phone, 
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
    
    // Use existing full_name if not provided (for partial updates like notes only)
    const finalFullName = full_name?.trim() || existingStudent.full_name;
    
    if (!finalFullName || finalFullName.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.fullNameRequired },
        { status: 400 }
      );
    }
    
    updateStudent(
      studentId,
      finalFullName,
      phone !== undefined ? phone?.trim() : existingStudent.phone,
      parent_name !== undefined ? parent_name?.trim() : existingStudent.parent_name,
      parent_phone !== undefined ? parent_phone?.trim() : existingStudent.parent_phone,
      notes !== undefined ? notes?.trim() : existingStudent.notes,
      birth_date !== undefined ? birth_date : existingStudent.birth_date,
      photo !== undefined ? photo : existingStudent.photo,
      school !== undefined ? school?.trim() : existingStudent.school,
      discount !== undefined ? discount?.trim() : existingStudent.discount,
      parent_relation !== undefined ? parent_relation?.trim() : existingStudent.parent_relation,
      parent2_name !== undefined ? parent2_name?.trim() : existingStudent.parent2_name,
      parent2_relation !== undefined ? parent2_relation?.trim() : existingStudent.parent2_relation,
      interested_courses !== undefined ? interested_courses : existingStudent.interested_courses,
      source !== undefined ? source?.trim() : existingStudent.source
    );
    
    return NextResponse.json({ message: 'Дані учня успішно оновлено' });
  } catch (error) {
    console.error('Update student error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/students/[id] - Archive, delete, or force delete student
export async function DELETE(
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
  
  const studentId = parseInt(params.id, 10);
  
  if (isNaN(studentId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidStudentId }, { status: 400 });
  }
  
  const existingStudent = getStudentById(studentId);
  
  if (!existingStudent) {
    return notFound(ERROR_MESSAGES.studentNotFound);
  }
  
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';
  const force = searchParams.get('force') === 'true';
  
  // Handle permanent force delete with password confirmation
  if (permanent && force) {
    // Parse request body for password confirmation
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Пароль обов\'язковий' },
        { status: 400 }
      );
    }
    
    const { password } = body;
    
    // Validate password is provided
    if (!password) {
      return NextResponse.json(
        { error: 'Пароль обов\'язковий' },
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
      return NextResponse.json({ error: 'Невірний пароль' }, { status: 401 });
    }
    
    // Perform force delete (bypasses group check)
    const deleteResult = forceDeleteStudent(studentId, user.id);
    
    if (!deleteResult.success) {
      return NextResponse.json({ error: deleteResult.error }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: 'Учня остаточно видалено разом з усіма записами',
      deletedGroups: deleteResult.groups?.length || 0
    });
  }
  
  // Handle check for active groups before permanent delete
  if (permanent) {
    const activeGroups = getStudentActiveGroups(studentId);
    
    if (activeGroups.length > 0) {
      // Return warning with list of groups
      return NextResponse.json({ 
        error: 'Учень бере участь у групах',
        warning: true,
        groups: activeGroups.map(g => ({
          id: g.id,
          title: g.title,
          course_title: g.course_title
        }))
      }, { status: 409 });
    }
    
    // No groups - just return info that student can be deleted (don't delete yet)
    // The actual deletion happens only with force=true parameter
    return NextResponse.json({ 
      canDelete: true,
      message: 'Учень не бере участь у групах'
    });
  }
  
  // Default: archive the student
  archiveStudent(studentId);
  return NextResponse.json({ message: 'Учня успішно архівовано' });
}

// PATCH /api/students/[id] - Restore student
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
  
  const studentId = parseInt(params.id, 10);
  
  if (isNaN(studentId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidStudentId }, { status: 400 });
  }
  
  const existingStudent = getStudentById(studentId);
  
  if (!existingStudent) {
    return notFound(ERROR_MESSAGES.studentNotFound);
  }
  
  restoreStudent(studentId);
  
  return NextResponse.json({ message: 'Учня успішно відновлено' });
}
