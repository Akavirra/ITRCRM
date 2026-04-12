import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import { all, get } from '@/db';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `Ти — розумний помічник CRM-системи для школи робототехніки "IT Robotics". Відповідай ТІЛЬКИ українською мовою.

Ти маєш доступ до бази даних CRM і можеш відповідати на запитання про:
- Учнів (students) — ім'я, контакти, батьки, групи, відвідуваність, оплати
- Групи (groups) — назва, курс, вчитель, розклад, ціна, учні
- Курси (courses) — назва, опис, вікова категорія
- Викладачі (teachers/users з role='teacher') — ім'я, контакти
- Заняття (lessons) — дата, час, тема, статус, відвідуваність
- Оплати (payments) — суми, місяці, боржники
- Відвідуваність (attendance) — present/absent/late/excused

Правила:
1. Відповідай коротко, чітко та по суті
2. Якщо потрібні дані з БД — використай відповідну функцію
3. Ніколи не показуй SQL-запити користувачу
4. Ніколи не змінюй дані — тільки читання (SELECT)
5. Форматуй числа зрозуміло (наприклад, "2 500 грн")
6. Якщо не знаєш відповіді — чесно скажи
7. Для дат у ВІДПОВІДЯХ використовуй формат "дд.мм.рррр"
8. Будь дружнім і корисним
9. КРИТИЧНО: При виклику функцій дати ЗАВЖДИ передавай у форматі YYYY-MM-DD (наприклад 2024-01-31), а місяці у форматі YYYY-MM (наприклад 2024-01). НІКОЛИ не використовуй формат дд.мм.рррр у параметрах функцій!`;

// Normalize date from any format to YYYY-MM-DD
function normalizeDate(value: unknown): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const s = value.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // YYYY-MM (month only) -> first day of month
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;

  // MM.YYYY -> first day
  const my = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (my) return `${my[2]}-${my[1].padStart(2, '0')}-01`;

  return undefined;
}

// Normalize month to YYYY-MM
function normalizeMonth(value: unknown): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const s = value.trim();

  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // MM.YYYY or MM/YYYY
  const my = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (my) return `${my[2]}-${my[1].padStart(2, '0')}`;

  // YYYY-MM-DD -> take month
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);

  return undefined;
}

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI помічник не налаштований. Додайте GROQ_API_KEY.' },
      { status: 503 }
    );
  }

  let body: { messages: any[] };
  try {
    body = await request.json();
  } catch {
    return badRequest('Невірний формат запиту');
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest('Повідомлення обов\'язкові');
  }

  const messages = body.messages;

  try {
    const result = streamText({
      model: groq(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'),
      system: SYSTEM_PROMPT,
      messages: messages,
      temperature: 0.3,
      tools: {
        query_students: tool({
          description: 'Пошук учнів за іменем, або отримання списку учнів. Повертає: id, full_name, phone, email, parent_name, parent_phone, birth_date, is_active, notes, discount.',
          parameters: z.object({
            search: z.string().optional().describe('Пошук по імені учня (часткове співпадіння)'),
            is_active: z.boolean().optional().describe('Фільтр за активністю'),
            limit: z.number().optional().default(20).describe('Максимальна кількість результатів (за замовчуванням 20)'),
          }),
          execute: async ({ search, is_active, limit }) => {
            let sql = `SELECT id, full_name, phone, email, parent_name, parent_phone, birth_date, is_active, notes, discount FROM students WHERE 1=1`;
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

            return await all(sql, sqlParams);
          },
        }),
        query_groups: tool({
          description: 'Отримання груп з інформацією про курс, вчителя, розклад. Повертає: id, title, course_title, teacher_name, weekly_day (1=Пн..7=Нд), start_time, duration_minutes, monthly_price, status, capacity, student_count.',
          parameters: z.object({
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

            return await all(sql, sqlParams);
          },
        }),
        query_student_groups: tool({
          description: 'Отримання груп конкретного учня або учнів конкретної групи.',
          parameters: z.object({
            student_id: z.number().optional().describe('ID учня для пошуку його груп'),
            group_id: z.number().optional().describe('ID групи для пошуку її учнів'),
          }),
          execute: async ({ student_id, group_id }) => {
            if (student_id) {
              return await all(`
                SELECT g.id, g.title, c.title as course_title, u.name as teacher_name,
                       sg.join_date, sg.is_active as enrollment_active, sg.status as enrollment_status
                FROM student_groups sg
                JOIN groups g ON sg.group_id = g.id
                LEFT JOIN courses c ON g.course_id = c.id
                LEFT JOIN users u ON g.teacher_id = u.id
                WHERE sg.student_id = $1
                ORDER BY sg.is_active DESC, g.title`, [student_id]);
            }
            if (group_id) {
              return await all(`
                SELECT s.id, s.full_name, s.phone, s.parent_name, s.parent_phone,
                       sg.join_date, sg.is_active as enrollment_active, sg.status as enrollment_status
                FROM student_groups sg
                JOIN students s ON sg.student_id = s.id
                WHERE sg.group_id = $1
                ORDER BY sg.is_active DESC, s.full_name`, [group_id]);
            }
            return [];
          },
        }),
        query_lessons: tool({
          description: 'Отримання занять з фільтрацією. Повертає: id, group_title, teacher_name, lesson_date, start_datetime, end_datetime, topic, status (scheduled/done/cancelled), present_count, absent_count.',
          parameters: z.object({
            group_id: z.number().optional().describe('Фільтр за ID групи'),
            date_from: z.string().optional().describe('Дата початку (YYYY-MM-DD)'),
            date_to: z.string().optional().describe('Дата кінця (YYYY-MM-DD)'),
            status: z.enum(['scheduled', 'done', 'cancelled']).optional().describe('Фільтр за статусом'),
            limit: z.number().optional().default(20).describe('Максимальна кількість результатів'),
          }),
          execute: async ({ group_id, date_from: df, date_to: dt, status, limit }) => {
            const date_from = normalizeDate(df);
            const date_to = normalizeDate(dt);
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
            if (date_from) {
              sql += ` AND l.lesson_date >= $${paramIdx}`;
              sqlParams.push(date_from);
              paramIdx++;
            }
            if (date_to) {
              sql += ` AND l.lesson_date <= $${paramIdx}`;
              sqlParams.push(date_to);
              paramIdx++;
            }
            if (status) {
              sql += ` AND l.status = $${paramIdx}`;
              sqlParams.push(status);
              paramIdx++;
            }
            sql += ` ORDER BY l.lesson_date DESC, l.start_datetime DESC LIMIT $${paramIdx}`;
            sqlParams.push(limit || 20);

            return await all(sql, sqlParams);
          },
        }),
        query_payments: tool({
          description: 'Отримання оплат з фільтрацією. Повертає: student_name, group_title, month, amount, method, paid_at, note.',
          parameters: z.object({
            student_id: z.number().optional().describe('Фільтр за ID учня'),
            group_id: z.number().optional().describe('Фільтр за ID групи'),
            month: z.string().optional().describe('Фільтр за місяцем (YYYY-MM)'),
            limit: z.number().optional().default(20).describe('Максимальна кількість результатів'),
          }),
          execute: async ({ student_id, group_id, month: m, limit }) => {
            const month = normalizeMonth(m);
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
              sql += ` AND p.month = $${paramIdx}`;
              sqlParams.push(month);
              paramIdx++;
            }
            sql += ` ORDER BY p.paid_at DESC LIMIT $${paramIdx}`;
            sqlParams.push(limit || 20);

            return await all(sql, sqlParams);
          },
        }),
        query_debts: tool({
          description: 'Отримання боржників — учнів, які не оплатили за певний місяць. Повертає: student_name, group_title, month, monthly_price, paid_amount, debt.',
          parameters: z.object({
            month: z.string().optional().describe('Місяць для перевірки (YYYY-MM). За замовчуванням — поточний.'),
          }),
          execute: async ({ month: m }) => {
            const month = m || new Date().toISOString().slice(0, 7);
            return await all(`
              SELECT s.full_name as student_name, g.title as group_title,
                     $1 as month, g.monthly_price,
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
              ORDER BY debt DESC`, [month]);
          },
        }),
        query_attendance: tool({
          description: 'Статистика відвідуваності учня або групи. Повертає кількість present, absent, late, excused.',
          parameters: z.object({
            student_id: z.number().optional().describe('ID учня'),
            group_id: z.number().optional().describe('ID групи'),
            date_from: z.string().optional().describe('Дата початку (YYYY-MM-DD)'),
            date_to: z.string().optional().describe('Дата кінця (YYYY-MM-DD)'),
          }),
          execute: async ({ student_id, group_id, date_from, date_to }) => {
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
            if (date_from) {
              sql += ` AND l.lesson_date >= $${paramIdx}`;
              sqlParams.push(date_from);
              paramIdx++;
            }
            if (date_to) {
              sql += ` AND l.lesson_date <= $${paramIdx}`;
              sqlParams.push(date_to);
              paramIdx++;
            }

            return await get(sql, sqlParams);
          },
        }),
        query_courses: tool({
          description: 'Отримання курсів. Повертає: id, title, description, age_min, duration_months, is_active, groups_count.',
          parameters: z.object({
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
            sql += ` ORDER BY c.title`;

            return await all(sql, sqlParams);
          },
        }),
        query_teachers: tool({
          description: 'Отримання викладачів. Повертає: id, name, email, phone, is_active, groups_count.',
          parameters: z.object({
            search: z.string().optional().describe('Пошук по імені'),
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
            sql += ` ORDER BY u.name`;

            return await all(sql, sqlParams);
          },
        }),
        query_absences: tool({
          description: 'Знайти учнів з пропусками (absent) за період. Повертає: student_name, group_title, absent_count, total_lessons. Корисно для запитань "хто пропускає", "в кого пропуски".',
          parameters: z.object({
            date_from: z.string().optional().describe('Дата початку (YYYY-MM-DD). За замовчуванням — початок поточного місяця.'),
            date_to: z.string().optional().describe('Дата кінця (YYYY-MM-DD). За замовчуванням — сьогодні.'),
            group_id: z.number().optional().describe('Фільтр за ID групи (опціонально)'),
            min_absences: z.number().optional().default(1).describe('Мінімальна кількість пропусків (за замовчуванням 1)'),
          }),
          execute: async ({ date_from: df, date_to: dt, group_id, min_absences }) => {
            const now = new Date();
            const date_from = df || `${now.toISOString().slice(0, 7)}-01`;
            const date_to = dt || now.toISOString().slice(0, 10);
            
            let sql = `
              SELECT s.full_name as student_name, g.title as group_title,
                     COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
                     COUNT(*) as total_lessons
              FROM attendance a
              JOIN lessons l ON a.lesson_id = l.id
              JOIN students s ON a.student_id = s.id
              LEFT JOIN groups g ON l.group_id = g.id
              WHERE l.lesson_date >= $1 AND l.lesson_date <= $2`;
            const sqlParams: unknown[] = [date_from, date_to];
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

            return await all(sql, sqlParams);
          },
        }),
        query_stats: tool({
          description: 'Загальна статистика CRM: кількість учнів, груп, курсів, вчителів, занять за період, загальна сума оплат.',
          parameters: z.object({
            period: z.enum(['today', 'week', 'month', 'year', 'all']).optional().default('month').describe('Період'),
          }),
          execute: async ({ period }) => {
            let dateFilter = '';
            const now = new Date();
            if (period === 'today') {
              dateFilter = `AND l.lesson_date = '${now.toISOString().slice(0, 10)}'`;
            } else if (period === 'week') {
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              dateFilter = `AND l.lesson_date >= '${weekAgo.toISOString().slice(0, 10)}'`;
            } else if (period === 'month') {
              dateFilter = `AND l.lesson_date >= '${now.toISOString().slice(0, 7)}-01'`;
            } else if (period === 'year') {
              dateFilter = `AND l.lesson_date >= '${now.getFullYear()}-01-01'`;
            }
          
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
          
            const lessonStats = await get<{ lessons_count: string; done_count: string }>(`
              SELECT COUNT(*) as lessons_count,
                     COUNT(*) FILTER (WHERE status = 'done') as done_count
              FROM lessons l WHERE 1=1 ${dateFilter}
            `);
          
            const paymentStats = await get<{ total_payments: string }>(`
              SELECT COALESCE(SUM(amount), 0) as total_payments
              FROM payments WHERE paid_at >= '${period === 'all' ? '2000-01-01' : now.toISOString().slice(0, 7) + '-01'}'
            `);
          
            return { ...stats, ...lessonStats, ...paymentStats };
          },
        }),
      } as any,
    });

    return result.toDataStreamResponse();
  } catch (error: unknown) {
    console.error('Assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Помилка AI: ${errorMessage}` },
      { status: 500 }
    );
  }
}
