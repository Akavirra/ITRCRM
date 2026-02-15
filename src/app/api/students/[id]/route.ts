import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getStudentById, getStudentWithGroups, updateStudent, archiveStudent, restoreStudent, deleteStudent, getStudentAttendanceHistory, getStudentPaymentHistory } from '@/lib/students';

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
    const { full_name, phone, parent_name, parent_phone, notes } = body;
    
    if (!full_name || full_name.trim().length === 0) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.fullNameRequired },
        { status: 400 }
      );
    }
    
    updateStudent(
      studentId,
      full_name.trim(),
      phone?.trim(),
      parent_name?.trim(),
      parent_phone?.trim(),
      notes?.trim()
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

// DELETE /api/students/[id] - Archive or delete student
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
  
  if (permanent) {
    deleteStudent(studentId);
    return NextResponse.json({ message: 'Учня остаточно видалено' });
  } else {
    archiveStudent(studentId);
    return NextResponse.json({ message: 'Учня успішно архівовано' });
  }
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
