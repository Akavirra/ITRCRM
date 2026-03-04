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

    const teachers = await all(`
      SELECT 
        u.id, u.public_id, u.name, u.email, u.phone, u.telegram_id, 
        u.photo_url, u.notes, u.is_active, u.created_at,
        (SELECT COUNT(*) FROM groups WHERE teacher_id = u.id AND status = 'active') as active_groups_count
      FROM users u
      WHERE u.role = 'teacher'
      ORDER BY u.name ASC
    `);

    // Отримуємо групи для кожного викладача
    const teachersWithGroups = await Promise.all(teachers.map(async (teacher: any) => {
      const groups = await all(`
        SELECT g.id, g.public_id, g.title, g.status, g.is_active,
               g.weekly_day, g.start_time,
               c.title as course_title
        FROM groups g
        LEFT JOIN courses c ON g.course_id = c.id
        WHERE g.teacher_id = $1 AND g.status = 'active'
        ORDER BY c.title ASC, g.weekly_day ASC, g.start_time ASC
      `, [teacher.id]);
      
      return {
        ...teacher,
        groups: groups || []
      };
    }));

    return NextResponse.json(teachersWithGroups);
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
      return badRequest('Email already exists');
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
