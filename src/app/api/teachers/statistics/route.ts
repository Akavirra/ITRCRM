import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

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

  // Aggregate per teacher
  const rows = await all<{
    teacher_id: number;
    teacher_name: string;
    lesson_id: number;
    capacity: number | null;
    present_count: string;
    makeup_count: string;
  }>(`
    SELECT
      COALESCE(ltr.replacement_teacher_id, l.teacher_id, g.teacher_id) AS teacher_id,
      u.name AS teacher_name,
      l.id AS lesson_id,
      g.capacity,
      COUNT(a.id) FILTER (WHERE a.status IN ('present', 'makeup_done')) AS present_count,
      COUNT(a.id) FILTER (WHERE a.status = 'makeup_done') AS makeup_count
    FROM lessons l
    JOIN groups g ON l.group_id = g.id
    LEFT JOIN lesson_teacher_replacements ltr ON ltr.lesson_id = l.id
    JOIN users u ON u.id = COALESCE(ltr.replacement_teacher_id, l.teacher_id, g.teacher_id)
    LEFT JOIN attendance a ON a.lesson_id = l.id
    WHERE l.status = 'done'
      AND EXTRACT(YEAR FROM l.lesson_date) = $1
      AND EXTRACT(MONTH FROM l.lesson_date) = $2
    GROUP BY COALESCE(ltr.replacement_teacher_id, l.teacher_id, g.teacher_id), u.name, l.id, g.capacity
    ORDER BY u.name ASC
  `, [year, month]);

  // Aggregate per teacher
  const teacherMap = new Map<number, {
    teacher_id: number;
    teacher_name: string;
    total_lessons: number;
    group_lessons: number;
    individual_lessons: number;
    total_present: number;
    total_makeup: number;
    total_salary: number;
  }>();

  for (const row of rows) {
    const tid = row.teacher_id;
    if (!teacherMap.has(tid)) {
      teacherMap.set(tid, {
        teacher_id: tid,
        teacher_name: row.teacher_name,
        total_lessons: 0,
        group_lessons: 0,
        individual_lessons: 0,
        total_present: 0,
        total_makeup: 0,
        total_salary: 0,
      });
    }
    const t = teacherMap.get(tid)!;
    const presentCount = parseInt(row.present_count as unknown as string, 10) || 0;
    const makeupCount = parseInt(row.makeup_count as unknown as string, 10) || 0;
    const isIndividual = row.capacity === 1;
    const rate = isIndividual ? salaryIndividual : salaryGroup;

    t.total_lessons++;
    if (isIndividual) t.individual_lessons++; else t.group_lessons++;
    t.total_present += presentCount;
    t.total_makeup += makeupCount;
    t.total_salary += presentCount * rate;
  }

  return NextResponse.json({
    year,
    month,
    salary_group_rate: salaryGroup,
    salary_individual_rate: salaryIndividual,
    teachers: Array.from(teacherMap.values()),
  });
}
