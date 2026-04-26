import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/db/neon';
import crypto from 'crypto';
import { toZonedTime } from 'date-fns-tz';

export const dynamic = 'force-dynamic';

const TIMEZONE = 'Europe/Kyiv';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function verifyInitData(initData: string): { valid: boolean; telegramId?: string } {
  if (!TELEGRAM_BOT_TOKEN) return { valid: false };
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    params.delete('hash');
    const paramsArray = Array.from(params.entries());
    paramsArray.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = paramsArray.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculatedHash !== hash) return { valid: false };
    const userJson = params.get('user');
    if (!userJson) return { valid: false };
    const user = JSON.parse(userJson);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (Math.floor(Date.now() / 1000) - authDate > 86400) return { valid: false };
    return { valid: true, telegramId: user.id.toString() };
  } catch {
    return { valid: false };
  }
}

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get('X-Telegram-Init-Data');
    if (!initData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verification = verifyInitData(initData);
    if (!verification.valid || !verification.telegramId) {
      return NextResponse.json({ error: 'Невірний initData' }, { status: 401 });
    }

    const teacher = await queryOne(
      `SELECT id, name FROM users WHERE telegram_id = $1 AND role = 'teacher' AND is_active = TRUE LIMIT 1`,
      [verification.telegramId]
    ) as { id: number; name: string } | null;

    if (!teacher) {
      return NextResponse.json({ error: 'Викладача не знайдено' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const nowKyiv = toZonedTime(new Date(), TIMEZONE);
    const year = parseInt(searchParams.get('year') || String(nowKyiv.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(nowKyiv.getMonth() + 1), 10);

    // Salary rates from system settings
    let salaryGroup = 75;
    let salaryIndividual = 100;
    try {
      const rateRows = (await query(
        `SELECT key, value FROM system_settings WHERE key IN ('teacher_salary_group', 'teacher_salary_individual')`
      ) || []) as Array<{ key: string; value: string }>;
      for (const r of rateRows) {
        if (r.key === 'teacher_salary_group') salaryGroup = parseFloat(r.value) || 75;
        if (r.key === 'teacher_salary_individual') salaryIndividual = parseFloat(r.value) || 100;
      }
    } catch { /* use defaults */ }

    // Completed lessons this month for this teacher (direct + replacements + individual)
    const lessonRows = (await query(`
      SELECT
        l.id AS lesson_id,
        l.lesson_date,
        g.id AS group_id,
        g.title AS group_title,
        g.capacity,
        (ltr.replacement_teacher_id IS NOT NULL) AS is_replacement,
        COUNT(a.id) FILTER (WHERE a.status IN ('present', 'makeup_done')) AS present_count
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
    `, [year, month, teacher.id]) || []) as Array<{
      lesson_id: number;
      lesson_date: string;
      group_id: number | null;
      group_title: string | null;
      capacity: number | null;
      is_replacement: boolean;
      present_count: string;
    }>;

    // Unique students who attended lessons this month
    const studentsRow = await queryOne(`
      SELECT COUNT(DISTINCT a.student_id) AS count
      FROM attendance a
      JOIN lessons l ON l.id = a.lesson_id
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN lesson_teacher_replacements ltr ON ltr.lesson_id = l.id
      WHERE l.status = 'done'
        AND a.status IN ('present', 'makeup_done')
        AND EXTRACT(YEAR FROM l.lesson_date) = $1
        AND EXTRACT(MONTH FROM l.lesson_date) = $2
        AND COALESCE(ltr.replacement_teacher_id, l.teacher_id, g.teacher_id) = $3
    `, [year, month, teacher.id]) as { count: string } | null;

    const lessons = lessonRows.map(row => {
      const presentCount = parseInt(row.present_count as unknown as string, 10) || 0;
      const isIndividual = !row.group_id || (row.capacity !== null && row.capacity <= 1);
      const rate = isIndividual ? salaryIndividual : salaryGroup;
      return {
        lesson_id: row.lesson_id,
        lesson_date: row.lesson_date,
        group_title: row.group_title,
        is_individual: isIndividual,
        is_replacement: row.is_replacement,
        present_count: presentCount,
        rate,
        salary: presentCount * rate,
      };
    });

    // Extra salary items (bonuses / deductions)
    let extraItems: Array<{ id: number; description: string; amount: number }> = [];
    try {
      extraItems = (await query(
        `SELECT id, description, amount::float AS amount
         FROM salary_extra_items
         WHERE teacher_id = $1 AND year = $2 AND month = $3
         ORDER BY created_at ASC`,
        [teacher.id, year, month]
      ) || []) as Array<{ id: number; description: string; amount: number }>;
    } catch { /* table may not exist yet */ }

    const lessonsTotal = lessons.reduce((s, l) => s + l.salary, 0);
    const extrasTotal = extraItems.reduce((s, i) => s + i.amount, 0);
    const studentsCount = parseInt(studentsRow?.count as unknown as string || '0', 10) || 0;

    return NextResponse.json({
      year,
      month,
      lessons_count: lessons.length,
      students_count: studentsCount,
      salary: lessonsTotal + extrasTotal,
      lessons_total: lessonsTotal,
      extras_total: extrasTotal,
      extra_items: extraItems,
      salary_group_rate: salaryGroup,
      salary_individual_rate: salaryIndividual,
      lessons,
    });

  } catch (error) {
    console.error('Teacher stats error:', error);
    return NextResponse.json({ error: 'Не вдалося завантажити статистику' }, { status: 500 });
  }
}
