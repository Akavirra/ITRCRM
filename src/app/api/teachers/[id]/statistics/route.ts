import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const teacherId = parseInt(params.id, 10);
  if (isNaN(teacherId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

  // Get salary rates
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
  } catch { /* table may not exist, use defaults */ }

  // Query all done lessons for this teacher in the given month
  const lessons = await all<{
    lesson_id: number;
    lesson_date: string;
    group_id: number;
    group_title: string;
    capacity: number | null;
    is_replacement: boolean;
    original_teacher_id: number | null;
    present_count: string;
    makeup_count: string;
  }>(`
    SELECT
      l.id AS lesson_id,
      l.lesson_date,
      g.id AS group_id,
      g.title AS group_title,
      g.capacity,
      (ltr.replacement_teacher_id IS NOT NULL) AS is_replacement,
      ltr.original_teacher_id,
      COUNT(a.id) FILTER (WHERE a.status IN ('present', 'makeup_done')) AS present_count,
      COUNT(a.id) FILTER (WHERE a.status = 'makeup_done') AS makeup_count
    FROM lessons l
    JOIN groups g ON l.group_id = g.id
    LEFT JOIN lesson_teacher_replacements ltr ON ltr.lesson_id = l.id
    LEFT JOIN attendance a ON a.lesson_id = l.id
    WHERE l.status = 'done'
      AND EXTRACT(YEAR FROM l.lesson_date) = $1
      AND EXTRACT(MONTH FROM l.lesson_date) = $2
      AND COALESCE(ltr.replacement_teacher_id, l.teacher_id, g.teacher_id) = $3
    GROUP BY l.id, g.id, g.title, g.capacity, ltr.replacement_teacher_id, ltr.original_teacher_id
    ORDER BY l.lesson_date ASC
  `, [year, month, teacherId]);

  let totalLessons = 0;
  let groupLessons = 0;
  let individualLessons = 0;
  let totalPresent = 0;
  let totalMakeup = 0;
  let totalSalary = 0;

  const lessonRows = lessons.map(row => {
    const presentCount = parseInt(row.present_count as unknown as string, 10) || 0;
    const makeupCount = parseInt(row.makeup_count as unknown as string, 10) || 0;
    const isIndividual = row.capacity === 1;
    const rate = isIndividual ? salaryIndividual : salaryGroup;
    const salary = presentCount * rate;

    totalLessons++;
    if (isIndividual) individualLessons++; else groupLessons++;
    totalPresent += presentCount;
    totalMakeup += makeupCount;
    totalSalary += salary;

    return {
      lesson_id: row.lesson_id,
      lesson_date: row.lesson_date,
      group_title: row.group_title,
      is_individual: isIndividual,
      is_replacement: row.is_replacement,
      present_count: presentCount,
      makeup_count: makeupCount,
      rate,
      salary,
    };
  });

  return NextResponse.json({
    year,
    month,
    teacher_id: teacherId,
    summary: {
      total_lessons: totalLessons,
      group_lessons: groupLessons,
      individual_lessons: individualLessons,
      total_present: totalPresent,
      total_makeup: totalMakeup,
      total_salary: totalSalary,
      salary_group_rate: salaryGroup,
      salary_individual_rate: salaryIndividual,
    },
    lessons: lessonRows,
  });
}
