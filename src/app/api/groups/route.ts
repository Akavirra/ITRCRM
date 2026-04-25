import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import {
  getGroupsWithDetails,
  getGroupsForTeacher,
  getGroupsFiltered,
  getGroupFilterOptions,
  createGroup,
  validateTime, 
  validateUrl,
  generateGroupTitle,
  addStudentToGroup,
  VALIDATION_ERRORS,
  type GroupStatus,
  type CreateGroupInput,
} from '@/lib/groups';
import { getCourseById } from '@/lib/courses';
import { addGroupHistoryEntry, formatStudentAddedDescription } from '@/lib/group-history';
import { safeAddStudentHistoryEntry, formatGroupJoinedDescription } from '@/lib/student-history';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  missingRequiredFields: "Відсутні обов'язкові поля",
  createFailed: 'Не вдалося створити групу',
  invalidTime: 'Некоректний формат часу. Використовуйте ГГ:ХХ',
  invalidUrl: 'Некоректний формат посилання',
  courseNotFound: 'Курс не знайдено',
  invalidDay: 'День тижня має бути від 1 до 7',
};

// SECURITY: public_id is always generated server-side.
// Any client-provided public_id is explicitly ignored to prevent:
// - ID prediction/enumeration attacks
// - Collisions with existing records
// - Format manipulation

// GET /api/groups - List groups
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const search = searchParams.get('search') || '';
  const courseId = searchParams.get('courseId');
  const teacherId = searchParams.get('teacherId');
  const status = searchParams.get('status') as GroupStatus | null;
  const basic = searchParams.get('basic') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;
  const offset = (page - 1) * limit;
  
  let groups;
  
  // Build filters
  const filters: {
    courseId?: number;
    teacherId?: number;
    status?: GroupStatus;
    search?: string;
    includeInactive: boolean;
    days?: number[];
  } = { includeInactive };
  
  if (courseId) filters.courseId = parseInt(courseId);
  if (teacherId) filters.teacherId = parseInt(teacherId);
  if (status && ['active', 'graduate', 'inactive'].includes(status)) {
    filters.status = status;
  }
  if (search) filters.search = search;
  
  // Handle days filter (can be comma-separated or multiple params)
  const daysParam = searchParams.get('days');
  if (daysParam) {
    const days = daysParam.split(',').map(d => parseInt(d)).filter(d => !isNaN(d) && d >= 1 && d <= 7);
    if (days.length > 0) {
      filters.days = days;
    }
  }
  
  if (basic) {
    groups = await getGroupFilterOptions(includeInactive);
  } else if (Object.keys(filters).length > 1 || search) {
    // Apply filters for admin
    groups = await getGroupsFiltered(filters, limit, offset);
  } else {
    groups = await getGroupsWithDetails(includeInactive, limit, offset);
  }

  return NextResponse.json({ groups, page, limit });
}

// POST /api/groups - Create group
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
    // The createGroup function always generates a unique server-side public_id
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
      student_ids,
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
    const course = await getCourseById(parseInt(course_id));
    if (!course) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.courseNotFound },
        { status: 400 }
      );
    }
    
    // Generate title from day, time, and course name
    const title = generateGroupTitle(dayNum, start_time, course.title);
    
    // Create group input
    // Business rule: duration_minutes is always 90 (ignore client input)
    // Business rule: monthly_price is not accepted (ignore client input)
    const input: CreateGroupInput = {
      course_id: parseInt(course_id),
      title,
      teacher_id: parseInt(teacher_id),
      weekly_day: dayNum,
      start_time,
      duration_minutes: 90,
      start_date: start_date || null,
      end_date,
      capacity: capacity ? parseInt(capacity) : undefined,
      monthly_price: 0,
      status: status || 'active',
      note,
      photos_folder_url,
      timezone: timezone || 'Europe/Uzhgorod',
    };
    
    const result = await createGroup(input);
    
    // Add history entry for group creation
    await addGroupHistoryEntry(
      result.id,
      'created',
      `Створено групу: ${title}`,
      user.id,
      user.name
    );
    
    // Add students to the group if provided
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const joinDate = start_date || new Date().toISOString().split('T')[0];
      
      for (const studentId of student_ids) {
        try {
          await addStudentToGroup(studentId, result.id, joinDate);
          
          // Get student name for history
          const student = await get<{ full_name: string }>(`SELECT full_name FROM students WHERE id = $1`, [studentId]);
          if (student) {
            await addGroupHistoryEntry(
              result.id,
              'student_added',
              formatStudentAddedDescription(student.full_name),
              user.id,
              user.name
            );
          }
          
          await safeAddStudentHistoryEntry(
            studentId, 
            'group_joined', 
            formatGroupJoinedDescription(title), 
            user.id, 
            user.name
          );
        } catch (studentErr) {
          console.error(`Failed to add student ${studentId} to group ${result.id}:`, studentErr);
          // Continue with other students even if one fails
        }
      }
    }
    
    return NextResponse.json({
      id: result.id,
      public_id: result.public_id,
      title,
      message: 'Групу успішно створено',
    });
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.createFailed },
      { status: 500 }
    );
  }
}
