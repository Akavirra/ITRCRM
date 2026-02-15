import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound, checkGroupAccess } from '@/lib/api-utils';
import { 
  getGroupById, 
  getGroupWithDetailsById, 
  updateGroup, 
  archiveGroup, 
  restoreGroup, 
  getStudentsInGroup,
  validateTime,
  validateUrl,
  generateGroupTitle,
  VALIDATION_ERRORS,
  type GroupStatus,
  type UpdateGroupInput,
} from '@/lib/groups';
import { getCourseById } from '@/lib/courses';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidGroupId: 'Невірний ID групи',
  groupNotFound: 'Групу не знайдено',
  missingRequiredFields: "Відсутні обов'язкові поля",
  updateFailed: 'Не вдалося оновити групу',
  invalidTime: 'Некоректний формат часу. Використовуйте ГГ:ХХ',
  invalidUrl: 'Некоректний формат посилання',
  courseNotFound: 'Курс не знайдено',
  invalidDay: 'День тижня має бути від 1 до 7',
};

// GET /api/groups/[id] - Get group by ID
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
  
  // Check access
  const hasAccess = await checkGroupAccess(user, groupId);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  const { searchParams } = new URL(request.url);
  const withStudents = searchParams.get('withStudents') === 'true';
  
  const group = getGroupWithDetailsById(groupId);
  
  if (!group) {
    return notFound(ERROR_MESSAGES.groupNotFound);
  }
  
  // Add students if requested
  const responseData: any = { group };
  if (withStudents) {
    responseData.students = getStudentsInGroup(groupId);
  }
  
  return NextResponse.json(responseData);
}

// PUT /api/groups/[id] - Update group
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
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  const existingGroup = getGroupById(groupId);
  
  if (!existingGroup) {
    return notFound(ERROR_MESSAGES.groupNotFound);
  }
  
  try {
    const body = await request.json();
    const {
      course_id,
      teacher_id,
      weekly_day,
      start_time,
      duration_minutes,
      start_date,
      end_date,
      capacity,
      monthly_price,
      status,
      note,
      photos_folder_url,
      timezone,
    } = body;
    
    // Validate required fields
    if (!course_id) {
      return NextResponse.json(
        { error: VALIDATION_ERRORS.courseRequired },
        { status: 400 }
      );
    }
    
    if (!teacher_id) {
      return NextResponse.json(
        { error: VALIDATION_ERRORS.teacherRequired },
        { status: 400 }
      );
    }
    
    if (weekly_day === undefined || weekly_day === null) {
      return NextResponse.json(
        { error: VALIDATION_ERRORS.dayRequired },
        { status: 400 }
      );
    }
    
    if (!start_time) {
      return NextResponse.json(
        { error: VALIDATION_ERRORS.timeRequired },
        { status: 400 }
      );
    }
    
    // Validate weekly_day (1-7)
    const dayNum = parseInt(weekly_day);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 7) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidDay },
        { status: 400 }
      );
    }
    
    // Validate time format
    if (!validateTime(start_time)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidTime },
        { status: 400 }
      );
    }
    
    // Validate URL if provided
    if (photos_folder_url && !validateUrl(photos_folder_url)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidUrl },
        { status: 400 }
      );
    }
    
    // Get course to generate title
    const course = getCourseById(parseInt(course_id));
    if (!course) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.courseNotFound },
        { status: 400 }
      );
    }
    
    // Generate title from day, time, and course name
    const title = generateGroupTitle(dayNum, start_time, course.title);
    
    // Update group input
    // Business rule: duration_minutes is always 90 (ignore client input)
    // Business rule: monthly_price is not accepted (ignore client input)
    const input: UpdateGroupInput = {
      course_id: parseInt(course_id),
      title,
      teacher_id: parseInt(teacher_id),
      weekly_day: dayNum,
      start_time,
      duration_minutes: 90,
      start_date,
      end_date,
      capacity: capacity ? parseInt(capacity) : undefined,
      monthly_price: 0,
      status: status || 'active',
      note,
      photos_folder_url,
      timezone: timezone || 'Europe/Uzhgorod',
    };
    
    updateGroup(groupId, input);
    
    return NextResponse.json({ 
      message: 'Групу успішно оновлено',
      title,
    });
  } catch (error) {
    console.error('Update group error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id] - Archive group
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
  
  const existingGroup = getGroupById(groupId);
  
  if (!existingGroup) {
    return notFound(ERROR_MESSAGES.groupNotFound);
  }
  
  archiveGroup(groupId);
  
  return NextResponse.json({ message: 'Групу успішно архівовано' });
}

// PATCH /api/groups/[id] - Restore group
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
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  const existingGroup = getGroupById(groupId);
  
  if (!existingGroup) {
    return notFound(ERROR_MESSAGES.groupNotFound);
  }
  
  restoreGroup(groupId);
  
  return NextResponse.json({ message: 'Групу успішно відновлено' });
}
