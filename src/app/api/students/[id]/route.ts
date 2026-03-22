import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getStudentById, getStudentWithGroups, updateStudent, archiveStudent, restoreStudent, deleteStudent, getStudentAttendanceHistory, getStudentPaymentHistory, getStudentActiveGroups, safeDeleteStudent, forceDeleteStudent } from '@/lib/students';
import { verifyPassword } from '@/lib/auth';
import { get } from '@/db';
import { safeAddStudentHistoryEntry, formatFieldEditedDescription } from '@/lib/student-history';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidStudentId: 'Невірний ID учня',
  studentNotFound: 'Учня не знайдено',
  fullNameRequired: "П.І.Б. обов'язкове",
  invalidEmail: 'Невірний формат email',
  updateFailed: 'Не вдалося оновити дані учня',
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

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
  
  const student = withGroups ? await getStudentWithGroups(studentId) : await getStudentById(studentId);
  
  if (!student) {
    return notFound(ERROR_MESSAGES.studentNotFound);
  }
  
  const response: any = { student };
  
  if (withAttendance) {
    response.attendanceHistory = await getStudentAttendanceHistory(studentId);
  }
  
  if (withPayments) {
    response.paymentHistory = await getStudentPaymentHistory(studentId);
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
  
  const existingStudent = await getStudentById(studentId);
  
  if (!existingStudent) {
    return notFound(ERROR_MESSAGES.studentNotFound);
  }
  
  try {
    const body = await request.json();
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
    
    // Use existing full_name if not provided (for partial updates like notes only)
    const finalFullName = full_name?.trim() || existingStudent.full_name;
    
    if (!finalFullName || finalFullName.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.fullNameRequired },
        { status: 400 }
      );
    }

    if (email !== undefined && email !== null && email.trim() && !isValidEmail(email)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidEmail },
        { status: 400 }
      );
    }
    
    await updateStudent(
      studentId,
      finalFullName,
      phone !== undefined ? phone?.trim() : existingStudent.phone,
      email !== undefined ? email?.trim() : existingStudent.email,
      parent_name !== undefined ? parent_name?.trim() : existingStudent.parent_name,
      parent_phone !== undefined ? parent_phone?.trim() : existingStudent.parent_phone,
      notes !== undefined ? notes?.trim() : existingStudent.notes,
      birth_date !== undefined ? birth_date : existingStudent.birth_date,
      photo !== undefined ? photo : existingStudent.photo,
      school !== undefined ? school?.trim() : existingStudent.school,
      discount !== undefined ? (discount != null ? parseInt(discount, 10) || 0 : null) : existingStudent.discount,
      parent_relation !== undefined ? parent_relation?.trim() : existingStudent.parent_relation,
      parent2_name !== undefined ? parent2_name?.trim() : existingStudent.parent2_name,
      parent2_relation !== undefined ? parent2_relation?.trim() : existingStudent.parent2_relation,
      interested_courses !== undefined ? interested_courses : existingStudent.interested_courses,
      source !== undefined ? source?.trim() : existingStudent.source
    );

    // Normalize dates to YYYY-MM-DD for comparison (DB returns full timestamp, form sends ISO string)
    const normalizeDate = (val: string | null | undefined): string | null => {
      if (!val) return null;
      try { return new Date(val).toISOString().slice(0, 10); } catch { return val; }
    };

    // Log field-by-field changes
    const trackedFields: Array<{ field: string; oldVal: string | null; newVal: string | null }> = [
      { field: 'full_name', oldVal: existingStudent.full_name ?? null, newVal: finalFullName ?? null },
      { field: 'phone', oldVal: existingStudent.phone ?? null, newVal: phone !== undefined ? (phone?.trim() ?? null) : (existingStudent.phone ?? null) },
      { field: 'email', oldVal: existingStudent.email ?? null, newVal: email !== undefined ? (email?.trim() ?? null) : (existingStudent.email ?? null) },
      { field: 'parent_name', oldVal: existingStudent.parent_name ?? null, newVal: parent_name !== undefined ? (parent_name?.trim() ?? null) : (existingStudent.parent_name ?? null) },
      { field: 'parent_phone', oldVal: existingStudent.parent_phone ?? null, newVal: parent_phone !== undefined ? (parent_phone?.trim() ?? null) : (existingStudent.parent_phone ?? null) },
      { field: 'birth_date', oldVal: normalizeDate(existingStudent.birth_date), newVal: birth_date !== undefined ? normalizeDate(birth_date) : normalizeDate(existingStudent.birth_date) },
      { field: 'school', oldVal: existingStudent.school ?? null, newVal: school !== undefined ? (school?.trim() ?? null) : (existingStudent.school ?? null) },
      { field: 'discount', oldVal: existingStudent.discount != null ? String(existingStudent.discount) : null, newVal: discount !== undefined ? (discount != null ? String(parseInt(discount, 10) || 0) : null) : (existingStudent.discount != null ? String(existingStudent.discount) : null) },
      { field: 'notes', oldVal: existingStudent.notes ?? null, newVal: notes !== undefined ? (notes?.trim() ?? null) : (existingStudent.notes ?? null) },
      { field: 'source', oldVal: existingStudent.source ?? null, newVal: source !== undefined ? (source?.trim() ?? null) : (existingStudent.source ?? null) },
      { field: 'parent_relation', oldVal: existingStudent.parent_relation ?? null, newVal: parent_relation !== undefined ? (parent_relation?.trim() ?? null) : (existingStudent.parent_relation ?? null) },
      { field: 'parent2_name', oldVal: existingStudent.parent2_name ?? null, newVal: parent2_name !== undefined ? (parent2_name?.trim() ?? null) : (existingStudent.parent2_name ?? null) },
      { field: 'parent2_relation', oldVal: existingStudent.parent2_relation ?? null, newVal: parent2_relation !== undefined ? (parent2_relation?.trim() ?? null) : (existingStudent.parent2_relation ?? null) },
      { field: 'interested_courses', oldVal: existingStudent.interested_courses ?? null, newVal: interested_courses !== undefined ? (interested_courses != null ? String(interested_courses) : null) : (existingStudent.interested_courses ?? null) },
    ];

    const changedFields = trackedFields.filter(
      ({ oldVal, newVal }) => String(oldVal ?? '') !== String(newVal ?? '')
    );

    const historyEntries: Promise<void>[] = changedFields.map(({ field, oldVal, newVal }) =>
      safeAddStudentHistoryEntry(studentId, 'edited', formatFieldEditedDescription(field, oldVal, newVal), user.id, user.name, String(oldVal ?? null), String(newVal ?? null))
    );

    // Photo tracked separately — don't show raw URLs in description
    if (photo !== undefined && photo !== existingStudent.photo) {
      const hadPhoto = !!existingStudent.photo;
      const hasPhoto = !!photo;
      const photoDesc = !hadPhoto && hasPhoto ? 'Додано фото' : hadPhoto && !hasPhoto ? 'Видалено фото' : 'Оновлено фото';
      historyEntries.push(safeAddStudentHistoryEntry(studentId, 'edited', photoDesc, user.id, user.name));
    }

    if (historyEntries.length > 0) {
      await Promise.all(historyEntries);
    } else {
      await safeAddStudentHistoryEntry(studentId, 'edited', 'Дані учня оновлено', user.id, user.name);
    }

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
  
  const existingStudent = await getStudentById(studentId);
  
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
      return NextResponse.json({ error: 'Невірний пароль' }, { status: 401 });
    }
    
    // Perform force delete (bypasses group check)
    const deleteResult = await forceDeleteStudent(studentId, user.id);
    
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
    const activeGroups = await getStudentActiveGroups(studentId);
    
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
  await archiveStudent(studentId);
  await safeAddStudentHistoryEntry(studentId, 'archived', 'Учня архівовано', user.id, user.name);
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
  
  const existingStudent = await getStudentById(studentId);
  
  if (!existingStudent) {
    return notFound(ERROR_MESSAGES.studentNotFound);
  }
  
  await restoreStudent(studentId);
  await safeAddStudentHistoryEntry(studentId, 'restored', 'Учня відновлено', user.id, user.name);

  return NextResponse.json({ message: 'Учня успішно відновлено' });
}
