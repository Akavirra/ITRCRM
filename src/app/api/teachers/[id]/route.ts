import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound, badRequest } from '@/lib/api-utils';
import { get, all, run } from '@/db';
import { verifyPassword } from '@/lib/auth';
import { uploadImage, deleteImage, getPublicIdFromUrl } from '@/lib/cloudinary';
import { clearServerCache } from '@/lib/server-cache';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  teacherNotFound: 'Викладача не знайдено',
  emailExists: 'Користувач з таким email вже існує',
  updateFailed: 'Не вдалося оновити викладача',
  hasActiveGroups: 'Неможливо видалити викладача. У нього є активні групи.',
};

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
    is_active: boolean;
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

    const existingTeacher = await get<{
      id: number;
      public_id: string | null;
      name: string;
      email: string;
      phone: string | null;
      telegram_id: string | null;
      notes: string | null;
      photo_url: string | null;
    }>(
      `SELECT id, public_id, name, email, phone, telegram_id, notes, photo_url
       FROM users
       WHERE id = $1 AND role = 'teacher'`,
      [params.id]
    );

    if (!existingTeacher) {
      return notFound(ERROR_MESSAGES.teacherNotFound);
    }

    let photoUrl: string | null | undefined = undefined;
    if (photo && photo.startsWith('data:')) {
      if (existingTeacher.photo_url?.startsWith('https://')) {
        const oldPublicId = getPublicIdFromUrl(existingTeacher.photo_url);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }

      const uploadResult = await uploadImage(photo, 'teachers');
      photoUrl = uploadResult.url;
    } else if (photo === null) {
      if (existingTeacher.photo_url?.startsWith('https://')) {
        const oldPublicId = getPublicIdFromUrl(existingTeacher.photo_url);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }

      photoUrl = null;
    } else if (photo) {
      photoUrl = photo;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone || null;
    const normalizedTelegramId = telegram_id || null;
    const normalizedNotes = notes || null;

    let updateQuery = `UPDATE users
     SET name = $1, email = $2, phone = $3, telegram_id = $4, notes = $5, updated_at = NOW()`;
    const updateParams: (string | number | null)[] = [
      trimmedName,
      trimmedEmail,
      normalizedPhone,
      normalizedTelegramId,
      normalizedNotes,
    ];

    if (photoUrl !== undefined) {
      updateQuery += `, photo_url = $${updateParams.length + 1}`;
      updateParams.push(photoUrl);
    }

    updateQuery += ` WHERE id = $${updateParams.length + 1} AND role = 'teacher'`;
    updateParams.push(params.id);

    await run(updateQuery, updateParams);
    clearServerCache('teachers:');

    await safeAddAuditEvent({
      entityType: 'teacher',
      entityId: existingTeacher.id,
      entityPublicId: existingTeacher.public_id,
      entityTitle: trimmedName,
      eventType: 'teacher_updated',
      eventBadge: toAuditBadge('teacher_updated'),
      description: `Оновлено дані викладача ${trimmedName}`,
      userId: user.id,
      userName: user.name,
      metadata: {
        previous: {
          name: existingTeacher.name,
          email: existingTeacher.email,
          phone: existingTeacher.phone,
          telegramId: existingTeacher.telegram_id,
          notes: existingTeacher.notes,
          photoUrl: existingTeacher.photo_url,
        },
        next: {
          name: trimmedName,
          email: trimmedEmail,
          phone: normalizedPhone,
          telegramId: normalizedTelegramId,
          notes: normalizedNotes,
          photoUrl: photoUrl === undefined ? existingTeacher.photo_url : photoUrl,
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Дані викладача оновлено' });
  } catch (error: any) {
    if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('unique constraint') || error.message?.includes('UNIQUE constraint')) {
      return badRequest(ERROR_MESSAGES.emailExists);
    }
    console.error('Update teacher error:', error);
    return NextResponse.json({ error: ERROR_MESSAGES.updateFailed }, { status: 500 });
  }
}

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

  const teacherRecord = await get<{ id: number; public_id: string | null; name: string; is_active: boolean }>(
    `SELECT id, public_id, name, is_active FROM users WHERE id = $1 AND role = 'teacher'`,
    [params.id]
  );
  if (!teacherRecord) {
    return notFound(ERROR_MESSAGES.teacherNotFound);
  }

  const { searchParams } = new URL(request.url);
  const checkOnly = searchParams.get('check') === 'true';
  const permanent = searchParams.get('permanent') === 'true';
  const force = searchParams.get('force') === 'true';

  if (permanent && force) {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Пароль обов'язковий" }, { status: 400 });
    }

    const { password } = body;
    if (!password) {
      return NextResponse.json({ error: "Пароль обов'язковий" }, { status: 400 });
    }

    const userWithPassword = await get<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [user.id]
    );

    if (!userWithPassword) {
      return unauthorized();
    }

    const isValidPassword = await verifyPassword(password, userWithPassword.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Невірний пароль' }, { status: 401 });
    }

    const activeGroups = await all<{ id: number; title: string; course_title: string }>(
      `SELECT g.id, g.title, c.title as course_title
       FROM groups g
       LEFT JOIN courses c ON g.course_id = c.id
       WHERE g.teacher_id = $1 AND g.is_active = TRUE`,
      [params.id]
    );

    await run(`UPDATE groups SET teacher_id = NULL WHERE teacher_id = $1`, [params.id]);
    await run(`DELETE FROM users WHERE id = $1 AND role = 'teacher'`, [params.id]);
    clearServerCache('teachers:');

    await safeAddAuditEvent({
      entityType: 'teacher',
      entityId: teacherRecord.id,
      entityPublicId: teacherRecord.public_id,
      entityTitle: teacherRecord.name,
      eventType: 'teacher_deleted',
      eventBadge: toAuditBadge('teacher_deleted'),
      description: `Викладача ${teacherRecord.name} остаточно видалено`,
      userId: user.id,
      userName: user.name,
      metadata: {
        deletedGroups: activeGroups.length,
      },
    });

    return NextResponse.json({
      message: 'Викладача остаточно видалено',
      deletedGroups: activeGroups.length,
    });
  }

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

  if (checkOnly) {
    if (activeGroups.length > 0) {
      return NextResponse.json({
        warning: true,
        groups: activeGroups.map(g => ({
          id: g.id,
          title: g.title,
          course_title: g.course_title,
          schedule: `${g.weekly_day}, ${g.start_time}`,
        })),
      }, { status: 409 });
    }
    return NextResponse.json({ canDelete: true });
  }

  if (!permanent && activeGroups.length > 0) {
    return NextResponse.json({
      error: `${ERROR_MESSAGES.hasActiveGroups} (${activeGroups.length} груп)`,
      warning: true,
      groups: activeGroups.map(g => ({
        id: g.id,
        title: g.title,
        course_title: g.course_title,
      })),
    }, { status: 409 });
  }

  await run(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [params.id]);
  clearServerCache('teachers:');

  await safeAddAuditEvent({
    entityType: 'teacher',
    entityId: teacherRecord.id,
    entityPublicId: teacherRecord.public_id,
    entityTitle: teacherRecord.name,
    eventType: 'teacher_deactivated',
    eventBadge: toAuditBadge('teacher_deactivated'),
    description: permanent && teacherRecord.is_active
      ? `Викладача ${teacherRecord.name} деактивовано перед остаточним видаленням`
      : `Викладача ${teacherRecord.name} деактивовано`,
    userId: user.id,
    userName: user.name,
    metadata: {
      permanent,
      activeGroups: activeGroups.length,
    },
  });

  if (permanent && teacherRecord.is_active) {
    return NextResponse.json({
      success: true,
      message: 'Викладача деактивовано. Тепер можна видалити остаточно.',
      deactivated: true,
    });
  }

  return NextResponse.json({ success: true, message: 'Викладача деактивовано' });
}
