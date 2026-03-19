import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { all, get } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const teacherId = parseInt(params.id, 10);
  if (isNaN(teacherId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

  // Salary rates
  let salaryGroup = 75;
  let salaryIndividual = 100;
  try {
    const rateRows = await all<{ key: string; value: string }>(
      `SELECT key, value FROM system_settings WHERE key IN ('teacher_salary_group', 'teacher_salary_individual')`
    );
    for (const r of rateRows) {
      if (r.key === 'teacher_salary_group') salaryGroup = parseFloat(r.value) || 75;
      if (r.key === 'teacher_salary_individual') salaryIndividual = parseFloat(r.value) || 100;
    }
  } catch { /* defaults */ }

  // Teacher info
  const teacher = await get<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE id = $1`,
    [teacherId]
  );
  if (!teacher) return NextResponse.json({ error: 'Викладача не знайдено' }, { status: 404 });

  // Lessons for this teacher this month
  const lessonRows = await all<{
    lesson_id: number;
    lesson_date: string;
    group_id: number | null;
    group_title: string | null;
    capacity: number | null;
    is_replacement: boolean;
    present_count: string;
    makeup_count: string;
    makeup_lesson_id: number | null;
  }>(`
    SELECT
      l.id AS lesson_id,
      l.lesson_date,
      g.id AS group_id,
      g.title AS group_title,
      g.capacity,
      (ltr.replacement_teacher_id IS NOT NULL) AS is_replacement,
      COUNT(a.id) FILTER (WHERE a.status IN ('present', 'makeup_done')) AS present_count,
      COUNT(a.id) FILTER (WHERE a.status = 'makeup_done') AS makeup_count,
      MIN(a.makeup_lesson_id) FILTER (WHERE a.status = 'makeup_done' AND a.makeup_lesson_id IS NOT NULL) AS makeup_lesson_id
    FROM lessons l
    LEFT JOIN groups g ON l.group_id = g.id
    LEFT JOIN lesson_teacher_replacements ltr ON ltr.lesson_id = l.id
    LEFT JOIN attendance a ON a.lesson_id = l.id
    WHERE l.status = 'done'
      AND EXTRACT(YEAR FROM l.lesson_date) = $1
      AND EXTRACT(MONTH FROM l.lesson_date) = $2
      AND COALESCE(ltr.replacement_teacher_id, l.teacher_id, g.teacher_id) = $3
    GROUP BY l.id, g.id, g.title, g.capacity, ltr.replacement_teacher_id
    ORDER BY l.lesson_date ASC
  `, [year, month, teacherId]);

  const lessons = lessonRows.map(row => {
    const presentCount = parseInt(row.present_count as unknown as string, 10) || 0;
    const makeupCount = parseInt(row.makeup_count as unknown as string, 10) || 0;
    const isIndividual = !row.group_id || row.capacity === 1;
    const rate = isIndividual ? salaryIndividual : salaryGroup;
    const salary = presentCount * rate;
    return {
      lesson_id: row.lesson_id,
      lesson_date: row.lesson_date,
      group_title: row.group_title,
      is_individual: isIndividual,
      is_replacement: row.is_replacement,
      present_count: presentCount,
      makeup_count: makeupCount,
      makeup_lesson_id: row.makeup_lesson_id ?? null,
      rate,
      salary,
    };
  });

  // Extra items
  let extraItems: { id: number; description: string; amount: number; created_at: string }[] = [];
  try {
    extraItems = await all<{ id: number; description: string; amount: number; created_at: string }>(
      `SELECT id, description, amount::float AS amount, created_at
       FROM salary_extra_items
       WHERE teacher_id = $1 AND year = $2 AND month = $3
       ORDER BY created_at ASC`,
      [teacherId, year, month]
    );
  } catch { /* table may not exist yet */ }

  const lessonsTotal = lessons.reduce((s, l) => s + l.salary, 0);
  const extrasTotal = extraItems.reduce((s, i) => s + i.amount, 0);

  return NextResponse.json({
    teacher,
    year,
    month,
    salary_group_rate: salaryGroup,
    salary_individual_rate: salaryIndividual,
    lessons,
    extra_items: extraItems,
    lessons_total: lessonsTotal,
    extras_total: extrasTotal,
    grand_total: lessonsTotal + extrasTotal,
  });
}
