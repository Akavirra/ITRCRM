import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, badRequest } from '@/lib/api-utils';
import { convertParticipantToStudent } from '@/lib/camp-participants';
import { safeAddStudentHistoryEntry } from '@/lib/student-history';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();

  const pid = parseInt(params.pid, 10);
  if (isNaN(pid)) return badRequest('Невірний ID');

  const campId = parseInt(params.id, 10);

  try {
    const result = await convertParticipantToStudent(pid, user.id);

    if (!result.already_existed && result.student_id) {
      const camp = await get<{ title: string }>(`SELECT title FROM camps WHERE id = $1`, [campId]);
      const campTitle = camp?.title ?? `Табір #${campId}`;
      await safeAddStudentHistoryEntry(
        result.student_id,
        'camp_converted_to_student',
        `Створений учень із учасника табору «${campTitle}»`,
        user.id,
        user.name,
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Convert to student error:', error);
    return NextResponse.json({ error: 'Не вдалося перетворити на учня' }, { status: 500 });
  }
}
