import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getStudentHistory, getRecentStudentHistory } from '@/lib/student-history';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidStudentId: 'Невірний ID учня',
  studentNotFound: 'Учня не знайдено',
};

// GET /api/students/[id]/history - Get student history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);

  if (!user) {
    return unauthorized();
  }

  const studentId = parseInt(params.id, 10);

  if (isNaN(studentId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidStudentId }, { status: 400 });
  }

  // Check student exists
  const student = await get<{ id: number }>('SELECT id FROM students WHERE id = $1', [studentId]);

  if (!student) {
    return NextResponse.json({ error: ERROR_MESSAGES.studentNotFound }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const recent = searchParams.get('recent') === 'true';
  const limit = searchParams.get('limit');

  let history;

  if (recent) {
    const limitCount = limit ? parseInt(limit, 10) : 4;
    history = await getRecentStudentHistory(studentId, limitCount);
  } else {
    history = await getStudentHistory(studentId);
  }

  return NextResponse.json({ history });
}
