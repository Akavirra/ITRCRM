import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound, badRequest } from '@/lib/api-utils';
import { get, all, run } from '@/db';
import { hashPassword } from '@/lib/auth';

// Ukrainian error messages
const ERROR_MESSAGES = {
  teacherNotFound: 'Викладача не знайдено',
  emailExists: 'Користувач з таким email вже існує',
  updateFailed: 'Не вдалося оновити викладача',
  hasActiveGroups: 'Неможливо видалити викладача. У нього є активні групи.',
};

// GET /api/teachers/[id] - Get teacher by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const teacher = get<{
    id: number;
    public_id: string | null;
    name: string;
    email: string;
    phone: string | null;
    telegram_id: string | null;
    photo_url: string | null;
    notes: string | null;
    is_active: number;
    created_at: string;
  }>(
    `SELECT id, public_id, name, email, phone, telegram_id, photo_url, notes, is_active, created_at
     FROM users
     WHERE id = ? AND role = 'teacher'`,
    [params.id]
  );
  
  if (!teacher) {
    return notFound(ERROR_MESSAGES.teacherNotFound);
  }
  
  // Get teacher's groups
  const groups = all<{
    id: number;
    public_id: string;
    title: string;
    course_id: number;
    weekly_day: number;
    start_time: string;
    duration_minutes: number;
    course_title: string;
  }>(
    `SELECT g.id, g.public_id, g.title, g.course_id, g.weekly_day, g.start_time, g.duration_minutes,
            c.title as course_title
     FROM groups g
     LEFT JOIN courses c ON g.course_id = c.id
     WHERE g.teacher_id = ? AND g.is_active = 1
     ORDER BY g.weekly_day, g.start_time`,
    [params.id]
  );
  
  return NextResponse.json({ ...teacher, groups });
}

// PUT /api/teachers/[id] - Update teacher
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
  
  try {
    const body = await request.json();
    const { name, email, phone, telegram_id, photo_url, notes, password } = body;
    
    if (!name || !email) {
      return badRequest("Ім'я та email обов'язкові");
    }
    
    // Check if teacher exists
    const existingTeacher = get<{ id: number }>(
      `SELECT id FROM users WHERE id = ? AND role = 'teacher'`,
      [params.id]
    );
    
    if (!existingTeacher) {
      return notFound(ERROR_MESSAGES.teacherNotFound);
    }
    
    // Build update query based on whether password is provided
    let updateQuery = `UPDATE users
     SET name = ?, email = ?, phone = ?, telegram_id = ?, photo_url = ?, notes = ?, updated_at = CURRENT_TIMESTAMP`;
    let updateParams = [name.trim(), email.trim().toLowerCase(), phone || null, telegram_id || null, photo_url || null, notes || null];
    
    if (password) {
      const hashedPassword = await hashPassword(password);
      updateQuery += `, password_hash = ?`;
      updateParams.push(hashedPassword);
    }
    
    updateQuery += ` WHERE id = ? AND role = 'teacher'`;
    updateParams.push(params.id);
    
    run(updateQuery, updateParams);
    
    return NextResponse.json({ success: true, message: 'Дані викладача оновлено' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('UNIQUE constraint')) {
      return badRequest(ERROR_MESSAGES.emailExists);
    }
    console.error('Update teacher error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.updateFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/teachers/[id] - Deactivate teacher
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
  
  // Check if teacher has active groups
  const activeGroups = get<{ count: number }>(
    `SELECT COUNT(*) as count FROM groups WHERE teacher_id = ? AND is_active = 1`,
    [params.id]
  );
  
  if (activeGroups && activeGroups.count > 0) {
    return badRequest(`${ERROR_MESSAGES.hasActiveGroups} (${activeGroups.count} груп)`);
  }
  
  // Deactivate instead of delete
  run(
    `UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [params.id]
  );
  
  return NextResponse.json({ success: true, message: 'Викладача деактивовано' });
}
