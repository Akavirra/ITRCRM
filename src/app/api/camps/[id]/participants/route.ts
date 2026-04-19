import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { listParticipants, createParticipant, searchAvailableStudentsForCamp } from '@/lib/camp-participants';
import { safeAddStudentHistoryEntry } from '@/lib/student-history';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const campId = parseInt(params.id, 10);
  if (isNaN(campId)) return badRequest('Невірний ID');

  const searchAvailable = request.nextUrl.searchParams.get('searchAvailableStudents');
  if (searchAvailable !== null) {
    const students = await searchAvailableStudentsForCamp(campId, searchAvailable, 20);
    return NextResponse.json({ students });
  }

  const shiftParam = request.nextUrl.searchParams.get('shiftId');
  const includeCancelled = request.nextUrl.searchParams.get('includeCancelled') === 'true';
  let shiftId: number | null | undefined = undefined;
  if (shiftParam !== null) {
    if (shiftParam === 'null' || shiftParam === '') shiftId = null;
    else {
      const n = parseInt(shiftParam, 10);
      if (!isNaN(n)) shiftId = n;
    }
  }

  const participants = await listParticipants(campId, { shiftId, includeCancelled });
  return NextResponse.json({ participants });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const campId = parseInt(params.id, 10);
  if (isNaN(campId)) return badRequest('Невірний ID');

  try {
    const body = await request.json();

    const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
    const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
    const studentId = body.student_id ? parseInt(String(body.student_id), 10) : null;

    if (!studentId && !firstName && !lastName) {
      return badRequest("Вкажіть учня з бази або введіть ім'я та прізвище");
    }

    let shiftId: number | null = null;
    if (body.shift_id !== undefined && body.shift_id !== null && body.shift_id !== '') {
      const n = parseInt(String(body.shift_id), 10);
      if (isNaN(n)) return badRequest('Невірний ID зміни');
      shiftId = n;
    }

    const days: string[] = Array.isArray(body.days)
      ? body.days.filter((d: unknown) => isValidDate(d))
      : [];

    const participant = await createParticipant({
      camp_id: campId,
      shift_id: shiftId,
      student_id: studentId || null,
      first_name: firstName,
      last_name: lastName,
      parent_name: body.parent_name ? String(body.parent_name) : null,
      parent_phone: body.parent_phone ? String(body.parent_phone) : null,
      notes: body.notes ? String(body.notes) : null,
      created_by: user.id,
      days,
    });

    // Log to student history if participant is from base
    if (participant.student_id) {
      const camp = await get<{ title: string }>(`SELECT title FROM camps WHERE id = $1`, [campId]);
      const campTitle = camp?.title ?? `Табір #${campId}`;
      const daysSuffix = days.length > 0 ? ` (${days.length} ${days.length === 1 ? 'день' : 'днів'})` : '';
      await safeAddStudentHistoryEntry(
        participant.student_id,
        'camp_joined',
        `Доданий до табору «${campTitle}»${daysSuffix}`,
        user.id,
        user.name,
        null,
        String(days.length),
      );
    }

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    console.error('Create participant error:', error);
    return NextResponse.json({ error: 'Не вдалося додати учасника' }, { status: 500 });
  }
}
