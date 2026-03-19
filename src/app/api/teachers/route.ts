import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, badRequest } from '@/lib/api-utils';
import { all, run, get } from '@/db';
import { hashPassword } from '@/lib/auth';
import { generatePublicId } from '@/lib/public-id';
import { uploadImage } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

// GET /api/teachers - список викладачів
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getAuthUser(req);
    if (!currentUser) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const simple = searchParams.get('simple') === 'true';

    // Lightweight mode: only id + name (for dropdowns)
    if (simple) {
      const teachers = await all<{ id: number; name: string }>(
        `SELECT id, name FROM users WHERE role = 'teacher' AND is_active = TRUE ORDER BY name ASC`
      );
      return NextResponse.json({ teachers });
    }

    // Full mode: teachers with their active groups (single JOIN query, no N+1)
    const rows = await all(`
      SELECT
        u.id, u.public_id, u.name, u.email, u.phone, u.telegram_id,
        u.photo_url, u.notes, u.is_active, u.created_at,
        (SELECT COUNT(*) FROM groups WHERE teacher_id = u.id AND status = 'active') AS active_groups_count,
        g.id          AS grp_id,
        g.public_id   AS grp_public_id,
        g.title       AS grp_title,
        g.status      AS grp_status,
        g.is_active   AS grp_is_active,
        g.weekly_day  AS grp_weekly_day,
        g.start_time  AS grp_start_time,
        c.title       AS grp_course_title
      FROM users u
      LEFT JOIN groups g ON g.teacher_id = u.id AND g.status = 'active'
      LEFT JOIN courses c ON c.id = g.course_id
      WHERE u.role = 'teacher'
      ORDER BY u.name ASC, c.title ASC, g.weekly_day ASC, g.start_time ASC
    `);

    // Collapse rows into per-teacher objects
    const teacherMap = new Map<number, any>();
    for (const row of rows as any[]) {
      if (!teacherMap.has(row.id)) {
        teacherMap.set(row.id, {
          id: row.id,
          public_id: row.public_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          telegram_id: row.telegram_id,
          photo_url: row.photo_url,
          notes: row.notes,
          is_active: row.is_active,
          created_at: row.created_at,
          active_groups_count: Number(row.active_groups_count),
          groups: [],
        });
      }
      if (row.grp_id) {
        teacherMap.get(row.id).groups.push({
          id: row.grp_id,
          public_id: row.grp_public_id,
          title: row.grp_title,
          status: row.grp_status,
          is_active: row.grp_is_active,
          weekly_day: row.grp_weekly_day,
          start_time: row.grp_start_time,
          course_title: row.grp_course_title,
        });
      }
    }

    const teachers = Array.from(teacherMap.values());
    return NextResponse.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/teachers - створення викладача
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getAuthUser(req);
    if (!currentUser) {
      return unauthorized();
    }
    
    if (currentUser.role !== 'admin') {
      return forbidden();
    }

    const { name, email, phone, telegram_id, notes, photo } = await req.json();

    if (!name || !email) {
      return badRequest('Name and email are required');
    }

    // Generate password if not provided (for auto-generated login)
    const password = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(password);
    
    // Generate unique public_id
    let publicId = generatePublicId('teacher');
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      const existing = await get<{ id: number }>('SELECT id FROM users WHERE public_id = $1', [publicId]);
      if (!existing) break;
      publicId = generatePublicId('teacher');
      retries++;
    }

    // Check if email is already taken
    const emailConflict = await get<{ role: string }>('SELECT role FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (emailConflict) {
      if (emailConflict.role === 'admin') {
        return badRequest('Цей email вже використовується адміністратором. Вкажіть інший email для викладача.');
      }
      return badRequest('Викладач з таким email вже існує');
    }

    // Handle photo - upload to Cloudinary if base64
    let photoUrl = null;
    if (photo && photo.startsWith('data:')) {
      // Upload photo to Cloudinary
      const uploadResult = await uploadImage(photo, 'teachers');
      photoUrl = uploadResult.url;
    }
    
    const result = await run(`
      INSERT INTO users (public_id, name, email, password_hash, role, phone, telegram_id, notes, photo_url, is_active)
      VALUES ($1, $2, $3, $4, 'teacher', $5, $6, $7, $8, TRUE)
      RETURNING id
    `, [publicId, name, email, hashedPassword, phone || null, telegram_id || null, notes || null, photoUrl]);

    return NextResponse.json({ 
      id: result[0]?.id, 
      public_id: publicId, 
      name, 
      email,
      auto_password: password // Return auto-generated password for admin to share
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating teacher:', error);
    if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('unique constraint') || error.message?.includes('UNIQUE constraint')) {
      return badRequest('Викладач з таким email вже існує');
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
