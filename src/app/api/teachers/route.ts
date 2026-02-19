import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden, badRequest } from '@/lib/api-utils';
import { all, run, get } from '@/db';
import { hashPassword } from '@/lib/auth';
import { generatePublicId } from '@/lib/public-id';

// GET /api/teachers - список викладачів
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getAuthUser(req);
    if (!currentUser) {
      return unauthorized();
    }

    const teachers = all(`
      SELECT 
        u.id, u.public_id, u.name, u.email, u.phone, u.telegram_id, 
        u.photo_url, u.notes, u.is_active, u.created_at,
        (SELECT COUNT(*) FROM groups WHERE teacher_id = u.id AND status = 'active') as active_groups_count
      FROM users u
      WHERE u.role = 'teacher'
      ORDER BY u.name ASC
    `);

    // Отримуємо групи для кожного викладача
    const teachersWithGroups = teachers.map((teacher: any) => {
      const groups = all(`
        SELECT g.id, g.public_id, g.title, g.status, g.is_active,
               g.weekly_day, g.start_time,
               c.title as course_title
        FROM groups g
        LEFT JOIN courses c ON g.course_id = c.id
        WHERE g.teacher_id = ? AND g.status = 'active'
        ORDER BY c.title ASC, g.weekly_day ASC, g.start_time ASC
      `, [teacher.id]);
      
      return {
        ...teacher,
        groups: groups || []
      };
    });

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

    const { name, email, password, phone, telegram_id, notes } = await req.json();

    if (!name || !email || !password) {
      return badRequest('Name, email and password are required');
    }

    const hashedPassword = await hashPassword(password);
    
    // Generate unique public_id
    let publicId = generatePublicId('teacher');
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      const existing = get<{ id: number }>('SELECT id FROM users WHERE public_id = ?', [publicId]);
      if (!existing) break;
      publicId = generatePublicId('teacher');
      retries++;
    }

    const result = run(`
      INSERT INTO users (public_id, name, email, password_hash, role, phone, telegram_id, notes, is_active)
      VALUES (?, ?, ?, ?, 'teacher', ?, ?, ?, 1)
    `, [publicId, name, email, hashedPassword, phone || null, telegram_id || null, notes || null]);

    return NextResponse.json({ id: result.lastInsertRowid, public_id: publicId, name, email }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating teacher:', error);
    if (error.message?.includes('UNIQUE constraint failed') || error.code === 'SQLITE_CONSTRAINT') {
      return badRequest('Email already exists');
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
