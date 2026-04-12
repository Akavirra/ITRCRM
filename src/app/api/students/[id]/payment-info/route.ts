import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get, all } from '@/db';
import { getIndividualLessonPrice, getLessonPrice } from '@/lib/payments';
import { getIndividualBalance } from '@/lib/individual-payments';

export const dynamic = 'force-dynamic';

// GET /api/students/[id]/payment-info
// Returns everything the payment modal needs: student info, groups, individual balance, pricing
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const studentId = parseInt(params.id, 10);
  if (isNaN(studentId)) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  const student = await get<{
    id: number;
    full_name: string;
    discount: number;
  }>(
    `SELECT id, full_name, COALESCE(discount::INTEGER, 0) as discount FROM students WHERE id = $1`,
    [studentId]
  );

  if (!student) {
    return NextResponse.json({ error: 'Учня не знайдено' }, { status: 404 });
  }

  const lessonPrice = await getLessonPrice();
  const effectivePrice = Math.round(lessonPrice * (1 - student.discount / 100));
  const individualLessonPrice = await getIndividualLessonPrice();

  // Student's active groups with payment status per current months
  const groups = await all<{
    group_id: number;
    group_title: string;
  }>(
    `SELECT g.id as group_id, g.title as group_title
     FROM student_groups sg
     JOIN groups g ON sg.group_id = g.id
     WHERE sg.student_id = $1 AND sg.is_active = TRUE AND g.is_active = TRUE
     ORDER BY g.title`,
    [studentId]
  );

  // Check if student has individual lessons
  const hasIndividual = await get<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM attendance a
     JOIN lessons l ON a.lesson_id = l.id
     WHERE a.student_id = $1 AND l.group_id IS NULL`,
    [studentId]
  );

  let individualBalance = null;
  if (hasIndividual && hasIndividual.cnt > 0) {
    individualBalance = await getIndividualBalance(studentId);
  }

  return NextResponse.json({
    student: {
      id: student.id,
      full_name: student.full_name,
      discount_percent: student.discount,
    },
    lesson_price: lessonPrice,
    effective_price: effectivePrice,
    individual_lesson_price: individualLessonPrice,
    groups,
    has_individual: (hasIndividual?.cnt || 0) > 0,
    individual_balance: individualBalance,
  });
}
