import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound, checkGroupAccess } from '@/lib/api-utils';
import {
  getGroupById,
  getGroupWithDetailsById,
  updateGroup, 
  updateGroupStatus,
  archiveGroup, 
  restoreGroup, 
  getStudentsInGroup,
  deleteGroup,
  checkGroupDeletion,
  validateTime,
  validateUrl,
  generateGroupTitle,
  VALIDATION_ERRORS,
  type GroupStatus,
  type UpdateGroupInput,
} from '@/lib/groups';
import { getCourseById } from '@/lib/courses';
import { verifyPassword } from '@/lib/auth';
import { get } from '@/db';
import { addGroupHistoryEntry, formatFieldEditedDescription, formatTeacherChangedDescription, formatStatusChangedDescription } from '@/lib/group-history';

export const dynamic = 'force-dynamic';

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

// GET /api/groups/[id] - Get group by ID or check deletion status
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
  const checkDelete = searchParams.get('checkDelete') === 'true';
  
  // If checking deletion status, admin only
  if (checkDelete) {
    if (!isAdmin(user)) {
      return forbidden();
    }
    
    const group = await getGroupById(groupId);
    if (!group) {
      return notFound(ERROR_MESSAGES.groupNotFound);
    }
    
    const deletionCheck = await checkGroupDeletion(groupId);
    return NextResponse.json(deletionCheck);
  }
  
  const group = await getGroupWithDetailsById(groupId);
  
  if (!group) {
    return notFound(ERROR_MESSAGES.groupNotFound);
  }
  
  // Add students if requested
  const responseData: any = { group };
  if (withStudents) {
    responseData.students = await getStudentsInGroup(groupId);
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
  
  const existingGroup = await getGroupById(groupId);
  
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
    
    // If only status is being updated, handle it separately
    if (status && !course_id && !teacher_id && !weekly_day && !start_time) {
      const oldStatus = existingGroup.status;
      await updateGroupStatus(groupId, status);
      
      // Add history entry for status change
      await addGroupHistoryEntry(
        groupId,
        'status_changed',
        formatStatusChangedDescription(oldStatus, status),
        user.id,
        user.name,
        oldStatus,
        status
      );
      return NextResponse.json({ 
        message: 'Статус групи успішно оновлено',
        status,
      });
    }
    
    // Validate required fields for full update
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
    const course = await getCourseById(parseInt(course_id));
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
    
    await updateGroup(groupId, input);
    
    // Get updated group with details
    const updatedGroup = await getGroupWithDetailsById(groupId);
    
    // Add history entry for group edit - check for teacher change and other fields
    const changes: string[] = [];
    
    // Check if teacher changed
    if (existingGroup.teacher_id !== parseInt(teacher_id)) {
      const oldTeacher = await get<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [existingGroup.teacher_id]);
      const newTeacher = await get<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [parseInt(teacher_id)]);
      if (oldTeacher && newTeacher) {
        await addGroupHistoryEntry(
          groupId,
          'teacher_changed',
          formatTeacherChangedDescription(oldTeacher.name, newTeacher.name),
          user.id,
          user.name,
          String(existingGroup.teacher_id),
          teacher_id
        );
      }
    }
    
    // Check other field changes
    if (existingGroup.course_id !== parseInt(course_id)) {
      const oldCourse = await get<{ title: string }>(`SELECT title FROM courses WHERE id = $1`, [existingGroup.course_id]);
      const newCourse = await get<{ title: string }>(`SELECT title FROM courses WHERE id = $1`, [parseInt(course_id)]);
      if (oldCourse && newCourse) {
        await addGroupHistoryEntry(
          groupId,
          'edited',
          formatFieldEditedDescription('course_id', oldCourse.title, newCourse.title),
          user.id,
          user.name
        );
      }
    }
    
    if (existingGroup.start_time !== start_time) {
      await addGroupHistoryEntry(
        groupId,
        'edited',
        formatFieldEditedDescription('start_time', existingGroup.start_time, start_time),
        user.id,
        user.name
      );
    }
    
    if (existingGroup.weekly_day !== dayNum) {
      const dayNames = ['', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
      await addGroupHistoryEntry(
        groupId,
        'edited',
        formatFieldEditedDescription('weekly_day', dayNames[existingGroup.weekly_day], dayNames[dayNum]),
        user.id,
        user.name
      );
    }
    
    if (status && existingGroup.status !== status) {
      await addGroupHistoryEntry(
        groupId,
        'status_changed',
        formatStatusChangedDescription(existingGroup.status, status),
        user.id,
        user.name,
        existingGroup.status,
        status
      );
    }
    
    // Check if note changed
    const oldNote = existingGroup.note;
    const newNote = note;
    if (oldNote !== newNote) {
      await addGroupHistoryEntry(
        groupId,
        'edited',
        formatFieldEditedDescription('note', oldNote, newNote),
        user.id,
        user.name,
        oldNote,
        newNote
      );
    }
    
    return NextResponse.json({ 
      message: 'Групу успішно оновлено',
      group: updatedGroup,
    });
  } catch (error) {
    console.error('Update group error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id] - Delete group with password confirmation (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    
    const existingGroup = await getGroupById(groupId);
    
    if (!existingGroup) {
      return notFound(ERROR_MESSAGES.groupNotFound);
    }
    
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
    
    // Delete the group
    const deleteResult = await deleteGroup(groupId);
    
    if (!deleteResult.success) {
      return NextResponse.json({ error: deleteResult.error }, { status: 409 });
    }
    
    return NextResponse.json({ message: 'Групу успішно видалено' });
  } catch (error) {
    console.error('Delete group error:', error);
    return NextResponse.json(
      { error: 'Сталася помилка. Спробуйте ще раз.' },
      { status: 500 }
    );
  }
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
  
  const existingGroup = await getGroupById(groupId);
  
  if (!existingGroup) {
    return notFound(ERROR_MESSAGES.groupNotFound);
  }
  
  await restoreGroup(groupId);
  
  return NextResponse.json({ message: 'Групу успішно відновлено' });
}
