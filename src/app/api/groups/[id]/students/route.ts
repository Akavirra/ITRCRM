import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { 
  getStudentsInGroup, 
  addStudentToGroup, 
  removeStudentFromGroup,
  removeStudentFromGroupByIDs,
  isStudentInGroup,
} from '@/lib/groups';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidGroupId: 'Невірний ID групи',
  invalidStudentId: 'Невірний ID учня',
  studentIdRequired: "ID учня обов'язковий",
  studentGroupIdRequired: "ID запису учня в групі обов'язковий",
  addStudentFailed: 'Не вдалося додати учня до групи',
  studentAlreadyInGroup: 'Учень вже є в цій групі',
  groupNotFound: 'Групу не знайдено',
};

// GET /api/groups/[id]/students - Get students in group
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  const hasAccess = await checkGroupAccess(user, groupId);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  const students = getStudentsInGroup(groupId);
  
  return NextResponse.json({ students });
}

// POST /api/groups/[id]/students - Add student to group
export async function POST(
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
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  try {
    const body = await request.json();
    const { student_id, join_date } = body;
    
    if (!student_id) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.studentIdRequired },
        { status: 400 }
      );
    }
    
    const studentId = parseInt(student_id);
    if (isNaN(studentId)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidStudentId },
        { status: 400 }
      );
    }
    
    // Check if student is already in group
    if (isStudentInGroup(studentId, groupId)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.studentAlreadyInGroup },
        { status: 400 }
      );
    }
    
    const studentGroupId = addStudentToGroup(
      studentId,
      groupId,
      join_date
    );
    
    return NextResponse.json({
      id: studentGroupId,
      message: 'Учня успішно додано до групи',
    });
  } catch (error) {
    console.error('Add student to group error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.addStudentFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/students - Remove student from group
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
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  const { searchParams } = new URL(request.url);
  const studentGroupId = searchParams.get('studentGroupId');
  const studentId = searchParams.get('studentId');
  
  // Support both studentGroupId and studentId for removal
  if (studentGroupId) {
    removeStudentFromGroup(parseInt(studentGroupId));
  } else if (studentId) {
    removeStudentFromGroupByIDs(parseInt(studentId), groupId);
  } else {
    return NextResponse.json(
      { error: ERROR_MESSAGES.studentGroupIdRequired },
      { status: 400 }
    );
  }
  
  return NextResponse.json({ message: 'Учня успішно видалено з групи' });
}
