import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { all, get } from '@/db';

import {
  getAssistantCurrentMonth,
  getAssistantMonthStart,
  getAssistantToday,
  getPaymentsRangeStart,
  getStatsDateFilter,
  normalizeDate,
  normalizeMonth,
  type AssistantStatsPeriod,
} from './date-utils';

export function createAssistantTools(now = new Date()): ToolSet {
  return {
    query_active_students_count: tool({
      description:
        'Швидкий підрахунок учнів. Корисно для запитів "скільки активних учнів", "скільки всього учнів". Повертає: total_students, active_students, inactive_students.',
      inputSchema: z.object({}),
      execute: async () => {
        return get<{
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
      },
    }),
    query_students: tool({
      description:
        "Пошук учнів за іменем, або отримання списку учнів. Повертає: id, full_name, phone, email, parent_name, parent_phone, birth_date, is_active, notes, discount.",
      inputSchema: z.object({
        search: z.string().optional().describe("Пошук по імені учня (часткове співпадіння)"),
        is_active: z.boolean().optional().describe('Фільтр за активністю'),
        limit: z.number().optional().default(20).describe('Максимальна кількість результатів (за замовчуванням 20)'),
      }),
      execute: async ({ search, is_active, limit }) => {
        let sql =
          'SELECT id, full_name, phone, email, parent_name, parent_phone, birth_date, is_active, notes, discount FROM students WHERE 1=1';
        const sqlParams: unknown[] = [];
        let paramIdx = 1;

        if (search) {
          sql += ` AND LOWER(full_name) LIKE LOWER($${paramIdx})`;
          sqlParams.push(`%${search}%`);
          paramIdx++;
        }

        if (is_active !== undefined) {
          sql += ` AND is_active = $${paramIdx}`;
          sqlParams.push(is_active);
          paramIdx++;
        }

        sql += ` ORDER BY full_name LIMIT $${paramIdx}`;
        sqlParams.push(limit || 20);

        return all(sql, sqlParams);
      },
    }),
    query_groups: tool({
      description:
        'Отримання груп з інформацією про курс, вчителя, розклад. Повертає: id, title, course_title, teacher_name, weekly_day (1=Пн..7=Нд), start_time, duration_minutes, monthly_price, status, capacity, student_count.',
      inputSchema: z.object({
        search: z.string().optional().describe('Пошук по назві групи'),
        status: z.enum(['active', 'paused', 'finished']).optional().describe('Фільтр за статусом'),
        limit: z.number().optional().default(20).describe('Максимальна кількість результатів'),
      }),
      execute: async ({ search, status, limit }) => {
        let sql = `
          SELECT g.id, g.title, c.title as course_title, u.name as teacher_name,
                 g.weekly_day, g.start_time, g.duration_minutes, g.monthly_price,
                 g.status, g.capacity,
                 (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = true) as student_count
          FROM groups g
          LEFT JOIN courses c ON g.course_id = c.id
          LEFT JOIN users u ON g.teacher_id = u.id
          WHERE g.is_active = true`;
        const sqlParams: unknown[] = [];
        let paramIdx = 1;

        if (search) {
          sql += ` AND LOWER(g.title) LIKE LOWER($${paramIdx})`;
          sqlParams.push(`%${search}%`);
          paramIdx++;
        }

        if (status) {
          sql += ` AND g.status = $${paramIdx}`;
          sqlParams.push(status);
          paramIdx++;
        }

        sql += ` ORDER BY g.title LIMIT $${paramIdx}`;
        sqlParams.push(limit || 20);

        return all(sql, sqlParams);
      },
    }),
    query_student_groups: tool({
      description: 'Отримання груп конкретного учня або учнів конкретної групи.',
      inputSchema: z.object({
        student_id: z.number().optional().describe('ID учня для пошуку його груп'),
        group_id: z.number().optional().describe('ID групи для пошуку її учнів'),
      }),
      execute: async ({ student_id, group_id }) => {
        if (student_id) {
          return all(
            `
              SELECT g.id, g.title, c.title as course_title, u.name as teacher_name,
                     sg.join_date, sg.is_active as enrollment_active, sg.status as enrollment_status
              FROM student_groups sg
              JOIN groups g ON sg.group_id = g.id
              LEFT JOIN courses c ON g.course_id = c.id
              LEFT JOIN users u ON g.teacher_id = u.id
              WHERE sg.student_id = $1
              ORDER BY sg.is_active DESC, g.title`,
            [student_id],
          );
        }

        if (group_id) {
          return all(
            `
              SELECT s.id, s.full_name, s.phone, s.parent_name, s.parent_phone,
                     sg.join_date, sg.is_active as enrollment_active, sg.status as enrollment_status
              FROM student_groups sg
              JOIN students s ON sg.student_id = s.id
              WHERE sg.group_id = $1
              ORDER BY sg.is_active DESC, s.full_name`,
            [group_id],
          );
        }

        return [];
      },
    }),
    query_lessons: tool({
      description:
        'Отримання занять з фільтрацією. Повертає: id, group_title, teacher_name, lesson_date, start_datetime, end_datetime, topic, status (scheduled/done/cancelled), present_count, absent_count.',
      inputSchema: z.object({
        group_id: z.number().optional().describe('Фільтр за ID групи'),
        date_from: z.string().optional().describe('Дата початку (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('Дата кінця (YYYY-MM-DD)'),
        status: z.enum(['scheduled', 'done', 'cancelled']).optional().describe('Фільтр за статусом'),
        limit: z.number().optional().default(20).describe('Максимальна кількість результатів'),
      }),
      execute: async ({ group_id, date_from: rawDateFrom, date_to: rawDateTo, status, limit }) => {
        const dateFrom = normalizeDate(rawDateFrom);
        const dateTo = normalizeDate(rawDateTo);
        let sql = `
          SELECT l.id, g.title as group_title, u.name as teacher_name,
                 l.lesson_date, l.start_datetime, l.end_datetime, l.topic, l.status,
                 (SELECT COUNT(*) FROM attendance a WHERE a.lesson_id = l.id AND a.status = 'present') as present_count,
                 (SELECT COUNT(*) FROM attendance a WHERE a.lesson_id = l.id AND a.status = 'absent') as absent_count
          FROM lessons l
          LEFT JOIN groups g ON l.group_id = g.id
          LEFT JOIN users u ON l.teacher_id = u.id
          WHERE 1=1`;
        const sqlParams: unknown[] = [];
        let paramIdx = 1;

        if (group_id) {
          sql += ` AND l.group_id = $${paramIdx}`;
          sqlParams.push(group_id);
          paramIdx++;
        }

        if (dateFrom) {
          sql += ` AND l.lesson_date >= $${paramIdx}`;
          sqlParams.push(dateFrom);
          paramIdx++;
        }

        if (dateTo) {
          sql += ` AND l.lesson_date <= $${paramIdx}`;
          sqlParams.push(dateTo);
          paramIdx++;
        }

        if (status) {
          sql += ` AND l.status = $${paramIdx}`;
          sqlParams.push(status);
          paramIdx++;
        }

        sql += ` ORDER BY l.lesson_date DESC, l.start_datetime DESC LIMIT $${paramIdx}`;
        sqlParams.push(limit || 20);

        return all(sql, sqlParams);
      },
    }),
    query_today_lessons: tool({
      description:
        'Швидкий список занять на сьогодні за часовою зоною Europe/Kyiv. Корисно для запитів "які заняття сьогодні". Повертає: id, group_title, teacher_name, lesson_date, start_datetime, end_datetime, topic, status.',
      inputSchema: z.object({
        group_id: z.number().optional().describe('Опціональний фільтр за ID групи'),
      }),
      execute: async ({ group_id }) => {
        const today = getAssistantToday(now);
        let sql = `
          SELECT l.id, g.title as group_title, u.name as teacher_name,
                 l.lesson_date, l.start_datetime, l.end_datetime, l.topic, l.status
          FROM lessons l
          LEFT JOIN groups g ON l.group_id = g.id
          LEFT JOIN users u ON l.teacher_id = u.id
          WHERE l.lesson_date = $1`;
        const sqlParams: unknown[] = [today];

        if (group_id) {
          sql += ' AND l.group_id = $2';
          sqlParams.push(group_id);
        }

        sql += ' ORDER BY l.start_datetime ASC';

        return all(sql, sqlParams);
      },
    }),
    query_daily_brief: tool({
      description:
        'Короткий зведений підсумок на сьогодні за часовою зоною Europe/Kyiv. Корисно для запитів "що сьогодні", "короткий звіт за день". Повертає: today, total_lessons, scheduled_lessons, done_lessons, cancelled_lessons, unique_groups, unique_teachers.',
      inputSchema: z.object({}),
      execute: async () => {
        const today = getAssistantToday(now);

        return get<{
          today: string;
          total_lessons: string;
          scheduled_lessons: string;
          done_lessons: string;
          cancelled_lessons: string;
          unique_groups: string;
          unique_teachers: string;
        }>(
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
      },
    }),
    query_payments: tool({
      description: 'Отримання оплат з фільтрацією. Повертає: student_name, group_title, month, amount, method, paid_at, note.',
      inputSchema: z.object({
        student_id: z.number().optional().describe('Фільтр за ID учня'),
        group_id: z.number().optional().describe('Фільтр за ID групи'),
        month: z.string().optional().describe('Фільтр за місяцем (YYYY-MM)'),
        limit: z.number().optional().default(20).describe('Максимальна кількість результатів'),
      }),
      execute: async ({ student_id, group_id, month: rawMonth, limit }) => {
        const month = normalizeMonth(rawMonth);
        let sql = `
          SELECT s.full_name as student_name, g.title as group_title,
                 p.month, p.amount, p.method, p.paid_at, p.note
          FROM payments p
          JOIN students s ON p.student_id = s.id
          LEFT JOIN groups g ON p.group_id = g.id
          WHERE 1=1`;
        const sqlParams: unknown[] = [];
        let paramIdx = 1;

        if (student_id) {
          sql += ` AND p.student_id = $${paramIdx}`;
          sqlParams.push(student_id);
          paramIdx++;
        }

        if (group_id) {
          sql += ` AND p.group_id = $${paramIdx}`;
          sqlParams.push(group_id);
          paramIdx++;
        }

        if (month) {
          sql += ` AND TO_CHAR(p.month, 'YYYY-MM') = $${paramIdx}`;
          sqlParams.push(month);
          paramIdx++;
        }

        sql += ` ORDER BY p.paid_at DESC LIMIT $${paramIdx}`;
        sqlParams.push(limit || 20);

        return all(sql, sqlParams);
      },
    }),
    query_debts: tool({
      description:
        'Отримання боржників — учнів, які не оплатили за певний місяць. Повертає: student_name, group_title, month, monthly_price, paid_amount, debt.',
      inputSchema: z.object({
        month: z.string().optional().describe('Місяць для перевірки (YYYY-MM). За замовчуванням — поточний.'),
      }),
      execute: async ({ month: rawMonth }) => {
        const month = normalizeMonth(rawMonth) || getAssistantCurrentMonth(now);
        const monthDate = `${month}-01`;

        return all(
          `
            SELECT s.full_name as student_name, g.title as group_title,
                   $2 as month, g.monthly_price,
                   COALESCE(p.paid_amount, 0) as paid_amount,
                   g.monthly_price - COALESCE(p.paid_amount, 0) as debt
            FROM student_groups sg
            JOIN students s ON sg.student_id = s.id
            JOIN groups g ON sg.group_id = g.id
            LEFT JOIN (
              SELECT student_id, group_id, SUM(amount) as paid_amount
              FROM payments WHERE month = $1
              GROUP BY student_id, group_id
            ) p ON p.student_id = sg.student_id AND p.group_id = sg.group_id
            WHERE sg.is_active = true AND g.is_active = true AND g.status = 'active'
              AND g.monthly_price - COALESCE(p.paid_amount, 0) > 0
            ORDER BY debt DESC`,
          [monthDate, month],
        );
      },
    }),
    query_debts_summary: tool({
      description:
        'Швидкий підсумок боргів за місяць. Корисно для запитів "скільки боржників цього місяця" або "загальна сума боргу". Повертає: debtors_count, total_debt, month.',
      inputSchema: z.object({
        month: z.string().optional().describe('Місяць для перевірки (YYYY-MM). За замовчуванням — поточний.'),
      }),
      execute: async ({ month: rawMonth }) => {
        const month = normalizeMonth(rawMonth) || getAssistantCurrentMonth(now);
        const monthDate = `${month}-01`;

        return get<{
          debtors_count: string;
          total_debt: string;
          month: string;
        }>(
          `
            SELECT
              COUNT(*) as debtors_count,
              COALESCE(SUM(debt), 0) as total_debt,
              $2 as month
            FROM (
              SELECT g.monthly_price - COALESCE(p.paid_amount, 0) as debt
              FROM student_groups sg
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
            ) debts
          `,
          [monthDate, month],
        );
      },
    }),
    query_at_risk_students: tool({
      description:
        'Знайти ризикових учнів за період: тих, у кого є пропуски або борг. Корисно для запитів "ризикові учні", "кому треба приділити увагу". Повертає: student_name, parent_name, parent_phone, group_title, absent_count, debt.',
      inputSchema: z.object({
        date_from: z.string().optional().describe('Дата початку періоду (YYYY-MM-DD). За замовчуванням — початок поточного місяця.'),
        date_to: z.string().optional().describe('Дата кінця періоду (YYYY-MM-DD). За замовчуванням — сьогодні.'),
        month: z.string().optional().describe('Місяць для перевірки боргу (YYYY-MM). За замовчуванням — поточний.'),
        min_absences: z.number().optional().default(2).describe('Мінімум пропусків для попадання в список'),
        min_debt: z.number().optional().default(1).describe('Мінімальний борг для попадання в список'),
        limit: z.number().optional().default(10).describe('Максимальна кількість записів'),
      }),
      execute: async ({ date_from: rawDateFrom, date_to: rawDateTo, month: rawMonth, min_absences, min_debt, limit }) => {
        const dateFrom = normalizeDate(rawDateFrom) || getAssistantMonthStart(now);
        const dateTo = normalizeDate(rawDateTo) || getAssistantToday(now);
        const month = normalizeMonth(rawMonth) || getAssistantCurrentMonth(now);
        const monthDate = `${month}-01`;

        return all(
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
          [dateFrom, dateTo, monthDate, min_absences || 2, min_debt || 1, limit || 10],
        );
      },
    }),
    query_attendance: tool({
      description: 'Статистика відвідуваності учня або групи. Повертає кількість present, absent, late, excused.',
      inputSchema: z.object({
        student_id: z.number().optional().describe('ID учня'),
        group_id: z.number().optional().describe('ID групи'),
        date_from: z.string().optional().describe('Дата початку (YYYY-MM-DD)'),
        date_to: z.string().optional().describe('Дата кінця (YYYY-MM-DD)'),
      }),
      execute: async ({ student_id, group_id, date_from: rawDateFrom, date_to: rawDateTo }) => {
        const dateFrom = normalizeDate(rawDateFrom);
        const dateTo = normalizeDate(rawDateTo);
        let sql = `
          SELECT
            COUNT(*) FILTER (WHERE a.status = 'present') as present,
            COUNT(*) FILTER (WHERE a.status = 'absent') as absent,
            COUNT(*) FILTER (WHERE a.status = 'late') as late,
            COUNT(*) FILTER (WHERE a.status = 'excused') as excused,
            COUNT(*) as total
          FROM attendance a
          JOIN lessons l ON a.lesson_id = l.id
          WHERE 1=1`;
        const sqlParams: unknown[] = [];
        let paramIdx = 1;

        if (student_id) {
          sql += ` AND a.student_id = $${paramIdx}`;
          sqlParams.push(student_id);
          paramIdx++;
        }

        if (group_id) {
          sql += ` AND l.group_id = $${paramIdx}`;
          sqlParams.push(group_id);
          paramIdx++;
        }

        if (dateFrom) {
          sql += ` AND l.lesson_date >= $${paramIdx}`;
          sqlParams.push(dateFrom);
          paramIdx++;
        }

        if (dateTo) {
          sql += ` AND l.lesson_date <= $${paramIdx}`;
          sqlParams.push(dateTo);
          paramIdx++;
        }

        return get(sql, sqlParams);
      },
    }),
    query_courses: tool({
      description: 'Отримання курсів. Повертає: id, title, description, age_min, duration_months, is_active, groups_count.',
      inputSchema: z.object({
        search: z.string().optional().describe('Пошук по назві курсу'),
        is_active: z.boolean().optional().describe('Фільтр за активністю'),
      }),
      execute: async ({ search, is_active }) => {
        let sql = `
          SELECT c.id, c.title, c.description, c.age_min, c.duration_months, c.is_active,
                 (SELECT COUNT(*) FROM groups g WHERE g.course_id = c.id AND g.is_active = true) as groups_count
          FROM courses c WHERE 1=1`;
        const sqlParams: unknown[] = [];
        let paramIdx = 1;

        if (search) {
          sql += ` AND LOWER(c.title) LIKE LOWER($${paramIdx})`;
          sqlParams.push(`%${search}%`);
          paramIdx++;
        }

        if (is_active !== undefined) {
          sql += ` AND c.is_active = $${paramIdx}`;
          sqlParams.push(is_active);
          paramIdx++;
        }

        sql += ' ORDER BY c.title';

        return all(sql, sqlParams);
      },
    }),
    query_teachers: tool({
      description: 'Отримання викладачів. Повертає: id, name, email, phone, is_active, groups_count.',
      inputSchema: z.object({
        search: z.string().optional().describe("Пошук по імені"),
        is_active: z.boolean().optional().describe('Фільтр за активністю'),
      }),
      execute: async ({ search, is_active }) => {
        let sql = `
          SELECT u.id, u.name, u.email, u.phone, u.is_active,
                 (SELECT COUNT(*) FROM groups g WHERE g.teacher_id = u.id AND g.is_active = true) as groups_count
          FROM users u WHERE u.role = 'teacher'`;
        const sqlParams: unknown[] = [];
        let paramIdx = 1;

        if (search) {
          sql += ` AND LOWER(u.name) LIKE LOWER($${paramIdx})`;
          sqlParams.push(`%${search}%`);
          paramIdx++;
        }

        if (is_active !== undefined) {
          sql += ` AND u.is_active = $${paramIdx}`;
          sqlParams.push(is_active);
          paramIdx++;
        }

        sql += ' ORDER BY u.name';

        return all(sql, sqlParams);
      },
    }),
    query_absences: tool({
      description:
        'Знайти учнів з пропусками (absent) за період. Повертає: student_name, group_title, absent_count, total_lessons. Корисно для запитань "хто пропускає", "в кого пропуски".',
      inputSchema: z.object({
        date_from: z.string().optional().describe('Дата початку (YYYY-MM-DD). За замовчуванням — початок поточного місяця.'),
        date_to: z.string().optional().describe('Дата кінця (YYYY-MM-DD). За замовчуванням — сьогодні.'),
        group_id: z.number().optional().describe('Фільтр за ID групи (опціонально)'),
        min_absences: z.number().optional().default(1).describe('Мінімальна кількість пропусків (за замовчуванням 1)'),
      }),
      execute: async ({ date_from: rawDateFrom, date_to: rawDateTo, group_id, min_absences }) => {
        const dateFrom = normalizeDate(rawDateFrom) || getAssistantMonthStart(now);
        const dateTo = normalizeDate(rawDateTo) || getAssistantToday(now);
        let sql = `
          SELECT s.full_name as student_name, g.title as group_title,
                 COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
                 COUNT(*) as total_lessons
          FROM attendance a
          JOIN lessons l ON a.lesson_id = l.id
          JOIN students s ON a.student_id = s.id
          LEFT JOIN groups g ON l.group_id = g.id
          WHERE l.lesson_date >= $1 AND l.lesson_date <= $2`;
        const sqlParams: unknown[] = [dateFrom, dateTo];
        let paramIdx = 3;

        if (group_id) {
          sql += ` AND l.group_id = $${paramIdx}`;
          sqlParams.push(group_id);
          paramIdx++;
        }

        sql += ` GROUP BY s.id, s.full_name, g.title
                 HAVING COUNT(*) FILTER (WHERE a.status = 'absent') >= $${paramIdx}
                 ORDER BY absent_count DESC
                 LIMIT 15`;
        sqlParams.push(min_absences || 1);

        return all(sql, sqlParams);
      },
    }),
    query_stats: tool({
      description: 'Загальна статистика CRM: кількість учнів, груп, курсів, вчителів, занять за період, загальна сума оплат.',
      inputSchema: z.object({
        period: z.enum(['today', 'week', 'month', 'year', 'all']).optional().default('month').describe('Період'),
      }),
      execute: async ({ period }) => {
        const selectedPeriod: AssistantStatsPeriod = period ?? 'month';
        const lessonDateFilter = getStatsDateFilter(selectedPeriod, now);

        const stats = await get<{
          total_students: string;
          active_students: string;
          total_groups: string;
          active_groups: string;
          total_courses: string;
          total_teachers: string;
        }>(`
          SELECT
            (SELECT COUNT(*) FROM students) as total_students,
            (SELECT COUNT(*) FROM students WHERE is_active = true) as active_students,
            (SELECT COUNT(*) FROM groups WHERE is_active = true) as total_groups,
            (SELECT COUNT(*) FROM groups WHERE is_active = true AND status = 'active') as active_groups,
            (SELECT COUNT(*) FROM courses WHERE is_active = true) as total_courses,
            (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = true) as total_teachers
        `);

        const lessonStats = await get<{ lessons_count: string; done_count: string }>(
          `
            SELECT COUNT(*) as lessons_count,
                   COUNT(*) FILTER (WHERE status = 'done') as done_count
            FROM lessons l
            WHERE 1=1 ${lessonDateFilter.clause}
          `,
          lessonDateFilter.params,
        );

        const paymentsRangeStart = getPaymentsRangeStart(selectedPeriod, now);
        const paymentStats = await get<{ total_payments: string }>(
          `
            SELECT COALESCE(SUM(amount), 0) as total_payments
            FROM payments
            WHERE paid_at >= $1
          `,
          [paymentsRangeStart],
        );

        return { ...stats, ...lessonStats, ...paymentStats };
      },
    }),
  };
}
