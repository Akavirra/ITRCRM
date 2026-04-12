import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import { all, get } from '@/db';
import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';

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
7. Для дат використовуй формат "дд.мм.рррр"
8. Будь дружнім і корисним`;

const DB_TOOLS: FunctionDeclaration[] = [
  {
    name: 'query_students',
    description: 'Пошук учнів за іменем, або отримання списку учнів. Повертає: id, full_name, phone, email, parent_name, parent_phone, birth_date, is_active, notes, discount. Можна фільтрувати по is_active (true/false) або шукати по імені (partial match).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: 'Пошук по імені учня (часткове співпадіння)' },
        is_active: { type: SchemaType.BOOLEAN, description: 'Фільтр за активністю (true = активні, false = неактивні)' },
        limit: { type: SchemaType.NUMBER, description: 'Максимальна кількість результатів (за замовчуванням 20)' },
      },
    },
  },
  {
    name: 'query_groups',
    description: 'Отримання груп з інформацією про курс, вчителя, розклад. Повертає: id, title, course_title, teacher_name, weekly_day (1=Пн..7=Нд), start_time, duration_minutes, monthly_price, status, capacity, student_count.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: 'Пошук по назві групи' },
        status: { type: SchemaType.STRING, description: 'Фільтр за статусом: active, paused, finished' },
        limit: { type: SchemaType.NUMBER, description: 'Максимальна кількість результатів (за замовчуванням 20)' },
      },
    },
  },
  {
    name: 'query_student_groups',
    description: 'Отримання груп конкретного учня або учнів конкретної групи.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        student_id: { type: SchemaType.NUMBER, description: 'ID учня для пошуку його груп' },
        group_id: { type: SchemaType.NUMBER, description: 'ID групи для пошуку її учнів' },
      },
    },
  },
  {
    name: 'query_lessons',
    description: 'Отримання занять з фільтрацією. Повертає: id, group_title, teacher_name, lesson_date, start_datetime, end_datetime, topic, status (scheduled/done/cancelled), present_count, absent_count.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        group_id: { type: SchemaType.NUMBER, description: 'Фільтр за ID групи' },
        date_from: { type: SchemaType.STRING, description: 'Дата початку (YYYY-MM-DD)' },
        date_to: { type: SchemaType.STRING, description: 'Дата кінця (YYYY-MM-DD)' },
        status: { type: SchemaType.STRING, description: 'Фільтр за статусом: scheduled, done, cancelled' },
        limit: { type: SchemaType.NUMBER, description: 'Максимальна кількість результатів (за замовчуванням 20)' },
      },
    },
  },
  {
    name: 'query_payments',
    description: 'Отримання оплат з фільтрацією. Повертає: student_name, group_title, month, amount, method, paid_at, note.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        student_id: { type: SchemaType.NUMBER, description: 'Фільтр за ID учня' },
        group_id: { type: SchemaType.NUMBER, description: 'Фільтр за ID групи' },
        month: { type: SchemaType.STRING, description: 'Фільтр за місяцем (YYYY-MM)' },
        limit: { type: SchemaType.NUMBER, description: 'Максимальна кількість результатів (за замовчуванням 20)' },
      },
    },
  },
  {
    name: 'query_debts',
    description: 'Отримання боржників — учнів, які не оплатили за певний місяць. Повертає: student_name, group_title, month, monthly_price, paid_amount, debt.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        month: { type: SchemaType.STRING, description: 'Місяць для перевірки (YYYY-MM). За замовчуванням — поточний.' },
      },
    },
  },
  {
    name: 'query_attendance',
    description: 'Статистика відвідуваності учня або групи. Повертає кількість present, absent, late, excused.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        student_id: { type: SchemaType.NUMBER, description: 'ID учня' },
        group_id: { type: SchemaType.NUMBER, description: 'ID групи' },
        date_from: { type: SchemaType.STRING, description: 'Дата початку (YYYY-MM-DD)' },
        date_to: { type: SchemaType.STRING, description: 'Дата кінця (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'query_courses',
    description: 'Отримання курсів. Повертає: id, title, description, age_min, duration_months, is_active, groups_count.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: 'Пошук по назві курсу' },
        is_active: { type: SchemaType.BOOLEAN, description: 'Фільтр за активністю' },
      },
    },
  },
  {
    name: 'query_teachers',
    description: 'Отримання викладачів. Повертає: id, name, email, phone, is_active, groups_count.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: 'Пошук по імені' },
        is_active: { type: SchemaType.BOOLEAN, description: 'Фільтр за активністю' },
      },
    },
  },
  {
    name: 'query_stats',
    description: 'Загальна статистика CRM: кількість учнів, груп, курсів, вчителів, занять за період, загальна сума оплат.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        period: { type: SchemaType.STRING, description: 'Період: today, week, month, year, all (за замовчуванням month)' },
      },
    },
  },
];

// Tool execution functions
async function executeQueryStudents(params: Record<string, unknown>) {
  const { search, is_active, limit = 20 } = params;
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
  sqlParams.push(limit);

  return all(sql, sqlParams);
}

async function executeQueryGroups(params: Record<string, unknown>) {
  const { search, status, limit = 20 } = params;
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
  sqlParams.push(limit);

  return all(sql, sqlParams);
}

async function executeQueryStudentGroups(params: Record<string, unknown>) {
  const { student_id, group_id } = params;

  if (student_id) {
    return all(`
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
    return all(`
      SELECT s.id, s.full_name, s.phone, s.parent_name, s.parent_phone,
             sg.join_date, sg.is_active as enrollment_active, sg.status as enrollment_status
      FROM student_groups sg
      JOIN students s ON sg.student_id = s.id
      WHERE sg.group_id = $1
      ORDER BY sg.is_active DESC, s.full_name`, [group_id]);
  }
  return [];
}

async function executeQueryLessons(params: Record<string, unknown>) {
  const { group_id, date_from, date_to, status, limit = 20 } = params;
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
  sqlParams.push(limit);

  return all(sql, sqlParams);
}

async function executeQueryPayments(params: Record<string, unknown>) {
  const { student_id, group_id, month, limit = 20 } = params;
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
  sqlParams.push(limit);

  return all(sql, sqlParams);
}

async function executeQueryDebts(params: Record<string, unknown>) {
  const month = (params.month as string) || new Date().toISOString().slice(0, 7);

  return all(`
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
}

async function executeQueryAttendance(params: Record<string, unknown>) {
  const { student_id, group_id, date_from, date_to } = params;
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

  return get(sql, sqlParams);
}

async function executeQueryCourses(params: Record<string, unknown>) {
  const { search, is_active } = params;
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

  return all(sql, sqlParams);
}

async function executeQueryTeachers(params: Record<string, unknown>) {
  const { search, is_active } = params;
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

  return all(sql, sqlParams);
}

async function executeQueryStats(params: Record<string, unknown>) {
  const period = (params.period as string) || 'month';

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
}

const TOOL_EXECUTORS: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  query_students: executeQueryStudents,
  query_groups: executeQueryGroups,
  query_student_groups: executeQueryStudentGroups,
  query_lessons: executeQueryLessons,
  query_payments: executeQueryPayments,
  query_debts: executeQueryDebts,
  query_attendance: executeQueryAttendance,
  query_courses: executeQueryCourses,
  query_teachers: executeQueryTeachers,
  query_stats: executeQueryStats,
};

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI помічник не налаштований. Додайте GEMINI_API_KEY.' },
      { status: 503 }
    );
  }

  let body: { messages: Array<{ role: string; content: string }> };
  try {
    body = await request.json();
  } catch {
    return badRequest('Невірний формат запиту');
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest('Повідомлення обов\'язкові');
  }

  // Limit message history to prevent abuse
  const messages = body.messages.slice(-20);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: DB_TOOLS }],
    });

    // Build chat history
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;

    // Send message and handle function calls
    let response = await chat.sendMessage(lastMessage);
    let result = response.response;

    // Handle up to 5 rounds of function calls
    for (let i = 0; i < 5; i++) {
      const functionCalls = result.functionCalls();
      if (!functionCalls || functionCalls.length === 0) break;

      const functionResponses = [];
      for (const call of functionCalls) {
        const executor = TOOL_EXECUTORS[call.name];
        if (executor) {
          try {
            const data = await executor(call.args as Record<string, unknown>);
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { data },
              },
            });
          } catch (error) {
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: 'Помилка виконання запиту' },
              },
            });
          }
        }
      }

      response = await chat.sendMessage(functionResponses);
      result = response.response;
    }

    const text = result.text();

    return NextResponse.json({ message: text });
  } catch (error: unknown) {
    console.error('Assistant error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Помилка AI: ${errorMessage}` },
      { status: 500 }
    );
  }
}
