import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound, badRequest } from '@/lib/api-utils';
import { get, all, run } from '@/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { uploadImage, deleteImage, getPublicIdFromUrl } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

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
  
  const teacher = await get<{
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
     WHERE id = $1 AND role = 'teacher'`,
    [params.id]
  );
  
  if (!teacher) {
    return notFound(ERROR_MESSAGES.teacherNotFound);
  }
  
  // Get teacher's groups
  const groups = await all<{
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
     WHERE g.teacher_id = $1 AND g.is_active = TRUE
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
    const { name, email, phone, telegram_id, notes, photo } = body;
    
    if (!name || !email) {
      return badRequest("Ім'я та email обов'язкові");
    }
    
    // Check if teacher exists
    const existingTeacher = await get<{ id: number; public_id: string | null }>(
      `SELECT id, public_id FROM users WHERE id = $1 AND role = 'teacher'`,
      [params.id]
    );
    
    if (!existingTeacher) {
      return notFound(ERROR_MESSAGES.teacherNotFound);
    }
    
    // Handle photo - upload to Cloudinary if base64
    let photoUrl: string | null | undefined = undefined;
    if (photo && photo.startsWith('data:')) {
      // Get existing photo URL to check if we need to delete old one
      const existingTeacherWithPhoto = await get<{ photo_url: string | null }>(
        `SELECT photo_url FROM users WHERE id = $1 AND role = 'teacher'`,
        [params.id]
      );
      
      // If old photo exists and is a Cloudinary URL (starts with https), delete it
      if (existingTeacherWithPhoto?.photo_url?.startsWith('https://')) {
        const oldPublicId = getPublicIdFromUrl(existingTeacherWithPhoto.photo_url);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }
      
      // Upload new photo to Cloudinary
      const uploadResult = await uploadImage(photo, 'teachers');
      photoUrl = uploadResult.url;
    } else if (photo === null) {
      // Photo was removed - delete old Cloudinary photo if exists
      const existingTeacherWithPhoto = await get<{ photo_url: string | null }>(
        `SELECT photo_url FROM users WHERE id = $1 AND role = 'teacher'`,
        [params.id]
      );
      
      if (existingTeacherWithPhoto?.photo_url?.startsWith('https://')) {
        const oldPublicId = getPublicIdFromUrl(existingTeacherWithPhoto.photo_url);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }
      
      // Set to null
      photoUrl = null;
    } else if (photo) {
      // Photo is a URL (unchanged)
      photoUrl = photo;
    }
    
    // Build update query
    let updateQuery = `UPDATE users
     SET name = $1, email = $2, phone = $3, telegram_id = $4, notes = $5, updated_at = NOW()`;
    let updateParams: (string | number | null)[] = [name.trim(), email.trim().toLowerCase(), phone || null, telegram_id || null, notes || null];
    
    if (photoUrl !== undefined) {
      updateQuery += `, photo_url = $6`;
      updateParams.push(photoUrl);
    }
    
    updateQuery += ` WHERE id = $7 AND role = 'teacher'`;
    updateParams.push(params.id);
    
    await run(updateQuery, updateParams);
    
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

// DELETE /api/teachers/[id] - Check groups, deactivate or permanently delete teacher
// Query params:
//   - check=true: Returns group information without deleting (for pre-delete warning)
//   - permanent=true&force=true: Permanently delete teacher (bypasses group check)
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
  
  const { searchParams } = new URL(request.url);
  const checkOnly = searchParams.get('check') === 'true';
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
    
    // Get teacher's active groups before deletion
    const activeGroups = await all<{
      id: number;
      title: string;
      course_title: string;
    }>(
      `SELECT g.id, g.title, c.title as course_title
       FROM groups g
       LEFT JOIN courses c ON g.course_id = c.id
       WHERE g.teacher_id = $1 AND g.is_active = TRUE`,
      [params.id]
    );
    
    // Remove teacher from groups (set to null)
    await run(`UPDATE groups SET teacher_id = NULL WHERE teacher_id = $1`, [params.id]);
    
    // Permanently delete the teacher
    await run(`DELETE FROM users WHERE id = $1 AND role = 'teacher'`, [params.id]);
    
    return NextResponse.json({ 
      message: 'Викладача остаточно видалено',
      deletedGroups: activeGroups.length
    });
  }
  
  // Get teacher's active groups with details
  const activeGroups = await all<{
    id: number;
    public_id: string;
    title: string;
    course_title: string;
    weekly_day: number;
    start_time: string;
    duration_minutes: number;
  }>(
    `SELECT g.id, g.public_id, g.title, c.title as course_title, g.weekly_day, g.start_time, g.duration_minutes
     FROM groups g
     LEFT JOIN courses c ON g.course_id = c.id
     WHERE g.teacher_id = $1 AND g.is_active = TRUE
     ORDER BY g.weekly_day, g.start_time`,
    [params.id]
  );
  
  // If checkOnly mode - return group information for warning dialog
  if (checkOnly) {
    if (activeGroups.length > 0) {
      return NextResponse.json({
        warning: true,
        groups: activeGroups.map(g => ({
          id: g.id,
          title: g.title,
          course_title: g.course_title,
          schedule: `${g.weekly_day}, ${g.start_time}`
        }))
      }, { status: 409 });
    }
    return NextResponse.json({ canDelete: true });
  }
  
  // Regular delete - check for active groups (only if not permanent)
  if (!permanent && activeGroups.length > 0) {
    return NextResponse.json({
      error: `${ERROR_MESSAGES.hasActiveGroups} (${activeGroups.length} груп)`,
      warning: true,
      groups: activeGroups.map(g => ({
        id: g.id,
        title: g.title,
        course_title: g.course_title
      }))
    }, { status: 409 });
  }
  
  // Check if teacher is active - if active, deactivate; if already inactive, allow permanent delete
  const teacher = await get<{ is_active: number }>(
    `SELECT is_active FROM users WHERE id = $1 AND role = 'teacher'`,
    [params.id]
  );
  
  if (!teacher) {
    return notFound(ERROR_MESSAGES.teacherNotFound);
  }
  
  // If permanent delete requested but teacher is still active, first deactivate
  if (permanent && teacher.is_active === 1) {
    await run(
      `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [params.id]
    );
    return NextResponse.json({ 
      success: true, 
      message: 'Викладача деактивовано. Тепер можна видалити остаточно.',
      deactivated: true 
    });
  }
  
  // Default: deactivate the teacher
  await run(
    `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
    [params.id]
  );
  
  return NextResponse.json({ success: true, message: 'Викладача деактивовано' });
}
