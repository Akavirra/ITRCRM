import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { 
  getGroupsWithDetails, 
  getGroupsForTeacher, 
  getGroupsFiltered,
  createGroup, 
  validateTime, 
  validateUrl,
  generateGroupTitle,
  VALIDATION_ERRORS,
  type GroupStatus,
  type CreateGroupInput,
} from '@/lib/groups';
import { getCourseById } from '@/lib/courses';

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
  
  let groups;
  
  // Build filters
  const filters: {
    courseId?: number;
    teacherId?: number;
    status?: GroupStatus;
    search?: string;
    includeInactive: boolean;
  } = { includeInactive };
  
  if (courseId) filters.courseId = parseInt(courseId);
  if (teacherId) filters.teacherId = parseInt(teacherId);
  if (status && ['active', 'graduate', 'inactive'].includes(status)) {
    filters.status = status;
  }
  if (search) filters.search = search;
  
  if (user.role === 'teacher') {
    // Teachers only see their own groups
    groups = getGroupsForTeacher(user.id, includeInactive);
  } else if (Object.keys(filters).length > 1 || search) {
    // Apply filters for admin
    groups = getGroupsFiltered(filters);
  } else {
    groups = getGroupsWithDetails(includeInactive);
  }
  
  return NextResponse.json({ groups });
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
      start_date,
      end_date,
      capacity: capacity ? parseInt(capacity) : undefined,
      monthly_price: 0,
      status: status || 'active',
      note,
      photos_folder_url,
      timezone: timezone || 'Europe/Uzhgorod',
    };
    
    const result = createGroup(input);
    
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
