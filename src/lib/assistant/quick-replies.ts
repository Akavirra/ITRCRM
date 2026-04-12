import { all, get } from '@/db';

import { ASSISTANT_TIMEZONE } from './constants';
import {
  getAssistantCurrentMonth,
  getAssistantMonthStart,
  getAssistantToday,
} from './date-utils';

type QuickReplyKind =
  | 'active-students'
  | 'today-lessons'
  | 'daily-brief'
  | 'monthly-debtors'
  | 'at-risk-students';

interface QuickReplyMatch {
  kind: QuickReplyKind;
}

interface QuickReplyContext {
  text: string;
  now?: Date;
}

interface LessonRow {
  id: number;
  group_title: string | null;
  teacher_name: string | null;
  start_datetime: string | Date | null;
  topic: string | null;
  status: string | null;
}

interface DailyBriefRow {
  today: string | Date;
  total_lessons: string;
  scheduled_lessons: string;
  done_lessons: string;
  cancelled_lessons: string;
  unique_groups: string;
  unique_teachers: string;
}

interface DebtorRow {
  student_name: string;
  group_title: string | null;
  debt: string | number;
  paid_amount: string | number;
  monthly_price: string | number;
}

interface AtRiskRow {
  student_name: string;
  parent_name: string | null;
  parent_phone: string | null;
  group_title: string | null;
  absent_count: string | number;
  debt: string | number;
}

function normalizePrompt(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatNumber(value: string | number) {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('uk-UA').format(numericValue).replace(/\u00a0/g, ' ');
}

function formatCurrency(value: string | number) {
  return `${formatNumber(value)} грн`;
}

function formatDateForReply(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
  }

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}

function formatTime(value: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: ASSISTANT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function matchAssistantQuickReply(text: string): QuickReplyMatch | null {
  const normalized = normalizePrompt(text);

  if (
    normalized.includes('активн') &&
    normalized.includes('учн') &&
    (normalized.includes('скіл') || normalized.includes('сколько') || normalized.includes('скiл'))
  ) {
    return { kind: 'active-students' };
  }

  if (
    normalized.includes('борж') &&
    (normalized.includes('цього місяця') ||
      normalized.includes('цього мiсяця') ||
      normalized.includes('за місяць') ||
      normalized.includes('за мiсяць'))
  ) {
    return { kind: 'monthly-debtors' };
  }

  if (normalized.includes('ризиков') && normalized.includes('учн')) {
    return { kind: 'at-risk-students' };
  }

  if (
    normalized.includes('занят') &&
    (normalized.includes('сьогодні') || normalized.includes('сьогоднi'))
  ) {
    return { kind: 'today-lessons' };
  }

  if (
    (normalized.includes('підсум') ||
      normalized.includes('пiдсум') ||
      normalized.includes('звіт') ||
      normalized.includes('звiт') ||
      normalized.includes('що сьогодні') ||
      normalized.includes('що сьогоднi')) &&
    (normalized.includes('сьогодні') ||
      normalized.includes('сьогоднi') ||
      normalized.includes('день') ||
      normalized.includes('дня'))
  ) {
    return { kind: 'daily-brief' };
  }

  return null;
}

async function buildActiveStudentsReply() {
  const stats = await get<{
    total_students: string;
    active_students: string;
    inactive_students: string;
  }>(`
    SELECT
      COUNT(*) as total_students,
      COUNT(*) FILTER (WHERE is_active = true) as active_students,
      COUNT(*) FILTER (WHERE is_active = false) as inactive_students
    FROM students
  `);

  if (!stats) {
    return 'Не вдалося отримати статистику по учнях.';
  }

  return [
    `Активних учнів: ${formatNumber(stats.active_students)}.`,
    `Усього в базі: ${formatNumber(stats.total_students)}, неактивних: ${formatNumber(stats.inactive_students)}.`,
  ].join('\n');
}

async function buildTodayLessonsReply(now: Date) {
  const today = getAssistantToday(now);
  const lessons = await all<LessonRow>(
    `
      SELECT
        l.id,
        g.title as group_title,
        u.name as teacher_name,
        l.start_datetime,
        l.topic,
        l.status
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN users u ON l.teacher_id = u.id
      WHERE l.lesson_date = $1
      ORDER BY l.start_datetime ASC
    `,
    [today],
  );

  if (lessons.length === 0) {
    return `На ${formatDateForReply(today)} занять немає.`;
  }

  const lines = lessons.slice(0, 8).map((lesson) => {
    const time = formatTime(lesson.start_datetime) || '--:--';
    const groupTitle = lesson.group_title || 'Без назви групи';
    const teacher = lesson.teacher_name ? `, викладач ${lesson.teacher_name}` : '';
    const topic = lesson.topic ? `, тема: ${lesson.topic}` : '';
    return `- ${time} — ${groupTitle}${teacher}${topic}`;
  });

  const moreCount = lessons.length - lines.length;

  return [
    `На ${formatDateForReply(today)} заплановано ${formatNumber(lessons.length)} занять.`,
    ...lines,
    moreCount > 0 ? `Ще занять: ${formatNumber(moreCount)}.` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function buildDailyBriefReply(now: Date) {
  const today = getAssistantToday(now);
  const brief = await get<DailyBriefRow>(
    `
      SELECT
        $1::date as today,
        COUNT(*) as total_lessons,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_lessons,
        COUNT(*) FILTER (WHERE status = 'done') as done_lessons,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_lessons,
        COUNT(DISTINCT group_id) as unique_groups,
        COUNT(DISTINCT teacher_id) as unique_teachers
      FROM lessons
      WHERE lesson_date = $1::date
    `,
    [today],
  );

  if (!brief) {
    return `Не вдалося зібрати короткий підсумок на ${formatDateForReply(today)}.`;
  }

  return [
    `Підсумок на ${formatDateForReply(today)}: ${formatNumber(brief.total_lessons)} занять.`,
    `Заплановано: ${formatNumber(brief.scheduled_lessons)}, проведено: ${formatNumber(brief.done_lessons)}, скасовано: ${formatNumber(brief.cancelled_lessons)}.`,
    `У роботі ${formatNumber(brief.unique_groups)} груп і ${formatNumber(brief.unique_teachers)} викладачів.`,
  ].join('\n');
}

async function buildMonthlyDebtorsReply(now: Date) {
  const month = getAssistantCurrentMonth(now);
  const monthDate = `${month}-01`;
  const debtors = await all<DebtorRow>(
    `
      SELECT
        s.full_name as student_name,
        g.title as group_title,
        g.monthly_price,
        COALESCE(p.paid_amount, 0) as paid_amount,
        g.monthly_price - COALESCE(p.paid_amount, 0) as debt
      FROM student_groups sg
      JOIN students s ON sg.student_id = s.id
      JOIN groups g ON sg.group_id = g.id
      LEFT JOIN (
        SELECT student_id, group_id, SUM(amount) as paid_amount
        FROM payments
        WHERE month = $1
        GROUP BY student_id, group_id
      ) p ON p.student_id = sg.student_id AND p.group_id = sg.group_id
      WHERE sg.is_active = true
        AND g.is_active = true
        AND g.status = 'active'
        AND g.monthly_price - COALESCE(p.paid_amount, 0) > 0
      ORDER BY debt DESC, s.full_name
    `,
    [monthDate],
  );

  if (debtors.length === 0) {
    return `За ${month} боржників немає.`;
  }

  const totalDebt = debtors.reduce((sum, debtor) => sum + Number(debtor.debt || 0), 0);
  const lines = debtors.slice(0, 8).map((debtor) => {
    const groupTitle = debtor.group_title || 'Без групи';
    return `- ${debtor.student_name} — ${groupTitle}: борг ${formatCurrency(debtor.debt)}`;
  });
  const moreCount = debtors.length - lines.length;

  return [
    `За ${month} боржників: ${formatNumber(debtors.length)}. Загальний борг: ${formatCurrency(totalDebt)}.`,
    ...lines,
    moreCount > 0 ? `Ще боржників: ${formatNumber(moreCount)}.` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function buildAtRiskStudentsReply(now: Date) {
  const dateFrom = getAssistantMonthStart(now);
  const dateTo = getAssistantToday(now);
  const month = getAssistantCurrentMonth(now);
  const monthDate = `${month}-01`;

  const students = await all<AtRiskRow>(
    `
      SELECT
        s.full_name as student_name,
        s.parent_name,
        s.parent_phone,
        g.title as group_title,
        COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
        GREATEST(g.monthly_price - COALESCE(p.paid_amount, 0), 0) as debt
      FROM student_groups sg
      JOIN students s ON sg.student_id = s.id
      JOIN groups g ON sg.group_id = g.id
      LEFT JOIN lessons l
        ON l.group_id = g.id
        AND l.lesson_date >= $1
        AND l.lesson_date <= $2
      LEFT JOIN attendance a
        ON a.lesson_id = l.id
        AND a.student_id = s.id
      LEFT JOIN (
        SELECT student_id, group_id, SUM(amount) as paid_amount
        FROM payments
        WHERE month = $3
        GROUP BY student_id, group_id
      ) p
        ON p.student_id = sg.student_id
        AND p.group_id = sg.group_id
      WHERE sg.is_active = true
        AND g.is_active = true
        AND g.status = 'active'
      GROUP BY s.id, s.full_name, s.parent_name, s.parent_phone, g.title, g.monthly_price, p.paid_amount
      HAVING
        COUNT(*) FILTER (WHERE a.status = 'absent') >= $4
        OR GREATEST(g.monthly_price - COALESCE(p.paid_amount, 0), 0) >= $5
      ORDER BY debt DESC, absent_count DESC, s.full_name
      LIMIT $6
    `,
    [dateFrom, dateTo, monthDate, 2, 1, 10],
  );

  if (students.length === 0) {
    return `За період ${formatDateForReply(dateFrom)}–${formatDateForReply(dateTo)} ризикових учнів не знайдено.`;
  }

  const lines = students.map((student) => {
    const flags: string[] = [];
    const absentCount = Number(student.absent_count || 0);
    const debt = Number(student.debt || 0);

    if (absentCount > 0) {
      flags.push(`${formatNumber(absentCount)} пропуск(и)`);
    }

    if (debt > 0) {
      flags.push(`борг ${formatCurrency(debt)}`);
    }

    const groupTitle = student.group_title || 'Без групи';
    return `- ${student.student_name} — ${groupTitle}: ${flags.join(', ')}`;
  });

  return [
    `Ризикових учнів за період ${formatDateForReply(dateFrom)}–${formatDateForReply(dateTo)}: ${formatNumber(students.length)}.`,
    ...lines,
  ].join('\n');
}

export async function getAssistantQuickReply({
  text,
  now = new Date(),
}: QuickReplyContext): Promise<string | null> {
  const match = matchAssistantQuickReply(text);

  if (!match) {
    return null;
  }

  switch (match.kind) {
    case 'active-students':
      return buildActiveStudentsReply();
    case 'today-lessons':
      return buildTodayLessonsReply(now);
    case 'daily-brief':
      return buildDailyBriefReply(now);
    case 'monthly-debtors':
      return buildMonthlyDebtorsReply(now);
    case 'at-risk-students':
      return buildAtRiskStudentsReply(now);
    default:
      return null;
  }
}
