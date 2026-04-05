import { run, get, all } from '@/db';
import { StudyStatus } from './students';

export type PaymentMethod = 'cash' | 'account';

export interface Payment {
  id: number;
  student_id: number;
  group_id: number;
  month: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  note: string | null;
  created_by: number;
  created_at: string;
}

export interface PaymentWithDetails extends Payment {
  student_name: string;
  group_title: string;
  created_by_name: string;
}

// Get payments for a group and month
export async function getPaymentsForGroupMonth(
  groupId: number,
  month: string
): Promise<PaymentWithDetails[]> {
  return await all<PaymentWithDetails>(
    `SELECT p.*, s.full_name as student_name, g.title as group_title, u.name as created_by_name
     FROM payments p
     JOIN students s ON p.student_id = s.id
     JOIN groups g ON p.group_id = g.id
     JOIN users u ON p.created_by = u.id
     WHERE p.group_id = $1 AND p.month = $2
     ORDER BY s.full_name`,
    [groupId, month]
  );
}

export interface StudentPaymentStatus {
  student_id: number;
  student_name: string;
  student_phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  discount_percent: number;
  lesson_price: number;
  effective_price: number;
  lessons_count: number;
  expected_amount: number;
  total_paid: number;
  debt: number;
  payments: Payment[];
}

// Get lesson price from system_settings
export async function getLessonPrice(): Promise<number> {
  const setting = await get<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = 'lesson_price'`
  );
  return parseInt(setting?.value || '300', 10);
}

// Get payment status for all students in a group for a month
export async function getPaymentStatusForGroupMonth(
  groupId: number,
  month: string
): Promise<StudentPaymentStatus[]> {
  const lessonPrice = await getLessonPrice();

  // Count all non-canceled lessons for this group in the given month
  const monthStr = month.substring(0, 7); // 'YYYY-MM'
  const lessonCountResult = await get<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM lessons
     WHERE group_id = $1 AND status != 'canceled' AND TO_CHAR(lesson_date, 'YYYY-MM') = $2`,
    [groupId, monthStr]
  );
  const lessonsCount = lessonCountResult?.cnt || 0;

  // Get all students in the group with discount
  const students = await all<{
    student_id: number;
    student_name: string;
    student_phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    discount: number | null;
  }>(
    `SELECT s.id as student_id, s.full_name as student_name, s.phone as student_phone,
            s.parent_name, s.parent_phone, COALESCE(s.discount::INTEGER, 0) as discount
     FROM students s
     JOIN student_groups sg ON s.id = sg.student_id
     WHERE sg.group_id = $1 AND sg.is_active = TRUE AND s.is_active = TRUE
     ORDER BY s.full_name`,
    [groupId]
  );

  return await Promise.all(students.map(async student => {
    const payments = await all<Payment>(
      `SELECT * FROM payments WHERE student_id = $1 AND group_id = $2 AND month = $3`,
      [student.student_id, groupId, month]
    );

    const discountPercent = student.discount || 0;
    const effectivePrice = Math.round(lessonPrice * (1 - discountPercent / 100));
    const expectedAmount = lessonsCount * effectivePrice;
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      student_id: student.student_id,
      student_name: student.student_name,
      student_phone: student.student_phone,
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      discount_percent: discountPercent,
      lesson_price: lessonPrice,
      effective_price: effectivePrice,
      lessons_count: lessonsCount,
      expected_amount: expectedAmount,
      total_paid: totalPaid,
      debt: Math.max(0, expectedAmount - totalPaid),
      payments
    };
  }));
}

// Create payment
export async function createPayment(
  studentId: number,
  groupId: number,
  month: string,
  amount: number,
  method: PaymentMethod,
  createdBy: number,
  note?: string,
  paidAt?: string
): Promise<number> {
  const result = await run(
    `INSERT INTO payments (student_id, group_id, month, amount, method, paid_at, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      studentId,
      groupId,
      month,
      amount,
      method,
      paidAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
      note || null,
      createdBy
    ]
  );
  
  return Number(result[0]?.id);
}

// Update payment
export async function updatePayment(
  id: number,
  amount: number,
  method: PaymentMethod,
  note?: string,
  paidAt?: string
): Promise<void> {
  await run(
    `UPDATE payments SET amount = $1, method = $2, paid_at = $3, note = $4 WHERE id = $5`,
    [amount, method, paidAt || new Date().toISOString().replace('T', ' ').substring(0, 19), note || null, id]
  );
}

// Delete payment
export async function deletePayment(id: number): Promise<void> {
  await run(`DELETE FROM payments WHERE id = $1`, [id]);
}

// Get payment by ID
export async function getPaymentById(id: number): Promise<Payment | null> {
  const payment = await get<Payment>(`SELECT * FROM payments WHERE id = $1`, [id]);
  return payment || null;
}

// Get payment statistics for a period
export async function getPaymentStats(
  startDate?: string,
  endDate?: string,
  groupId?: number,
  courseId?: number
): Promise<{
  total_amount: number;
  cash_amount: number;
  account_amount: number;
  payments_count: number;
}> {
  let sql = `SELECT 
    SUM(p.amount) as total_amount,
    SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END) as cash_amount,
    SUM(CASE WHEN p.method = 'account' THEN p.amount ELSE 0 END) as account_amount,
    COUNT(*) as payments_count
   FROM payments p
   JOIN groups g ON p.group_id = g.id
   WHERE 1=1`;
  
  const params: (string | number)[] = [];
  let paramIndex = 1;
  
  if (startDate) {
    sql += ` AND p.month >= $${paramIndex++}`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND p.month <= $${paramIndex++}`;
    params.push(endDate);
  }
  
  if (groupId) {
    sql += ` AND p.group_id = $${paramIndex++}`;
    params.push(groupId);
  }
  
  if (courseId) {
    sql += ` AND g.course_id = $${paramIndex++}`;
    params.push(courseId);
  }
  
  const result = await get<{
    total_amount: number;
    cash_amount: number;
    account_amount: number;
    payments_count: number;
  }>(sql, params);
  
  return result || { total_amount: 0, cash_amount: 0, account_amount: 0, payments_count: 0 };
}

// Get all payments for export
export async function getPaymentsForExport(
  startDate?: string,
  endDate?: string,
  groupId?: number,
  courseId?: number
): Promise<PaymentWithDetails[]> {
  let sql = `SELECT p.*, s.full_name as student_name, g.title as group_title, u.name as created_by_name
             FROM payments p
             JOIN students s ON p.student_id = s.id
             JOIN groups g ON p.group_id = g.id
             JOIN users u ON p.created_by = u.id
             WHERE 1=1`;
  
  const params: (string | number)[] = [];
  let paramIndex = 1;
  
  if (startDate) {
    sql += ` AND p.month >= $${paramIndex++}`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND p.month <= $${paramIndex++}`;
    params.push(endDate);
  }
  
  if (groupId) {
    sql += ` AND p.group_id = $${paramIndex++}`;
    params.push(groupId);
  }
  
  if (courseId) {
    sql += ` AND g.course_id = $${paramIndex++}`;
    params.push(courseId);
  }
  
  sql += ` ORDER BY p.month DESC, s.full_name`;
  
  return await all<PaymentWithDetails>(sql, params);
}

// Payment status for a specific lesson (per student)
export interface LessonPaymentInfo {
  status: 'paid' | 'partial' | 'unpaid';
  label: string;
}

export async function getPaymentStatusForLesson(
  lessonId: number
): Promise<Map<number, LessonPaymentInfo>> {
  const result = new Map<number, LessonPaymentInfo>();

  const lesson = await get<{ group_id: number | null; month_str: string }>(
    `SELECT group_id, TO_CHAR(lesson_date, 'YYYY-MM') as month_str FROM lessons WHERE id = $1`,
    [lessonId]
  );
  if (!lesson) return result;

  const lessonPrice = await getLessonPrice();

  if (lesson.group_id) {
    // Group lesson: check monthly payment status per student
    const rows = await all<{
      student_id: number;
      discount: number;
      lessons_in_month: number;
      total_paid: number;
    }>(
      `SELECT sg.student_id,
        COALESCE(s.discount::INTEGER, 0) as discount,
        (SELECT COUNT(*) FROM lessons l2
         WHERE l2.group_id = $1 AND TO_CHAR(l2.lesson_date, 'YYYY-MM') = $2
           AND l2.status != 'canceled') as lessons_in_month,
        COALESCE((SELECT SUM(p.amount) FROM payments p
         WHERE p.student_id = sg.student_id AND p.group_id = $1
           AND TO_CHAR(p.month, 'YYYY-MM') = $2), 0) as total_paid
       FROM student_groups sg
       JOIN students s ON sg.student_id = s.id
       WHERE sg.group_id = $1 AND sg.is_active = TRUE AND s.is_active = TRUE`,
      [lesson.group_id, lesson.month_str]
    );

    for (const row of rows) {
      const effectivePrice = Math.round(lessonPrice * (1 - row.discount / 100));
      const expected = row.lessons_in_month * effectivePrice;
      let status: LessonPaymentInfo['status'];
      let label: string;

      if (expected === 0 || row.total_paid >= expected) {
        status = 'paid';
        label = 'Оплачено';
      } else if (row.total_paid > 0) {
        status = 'partial';
        label = 'Частково';
      } else {
        status = 'unpaid';
        label = 'Не оплачено';
      }
      result.set(row.student_id, { status, label });
    }
  } else {
    // Individual lesson: check balance for each student in the attendance list
    const attendanceStudents = await all<{ student_id: number }>(
      `SELECT student_id FROM attendance WHERE lesson_id = $1`,
      [lessonId]
    );

    for (const { student_id } of attendanceStudents) {
      const balance = await get<{ lessons_paid: number; lessons_used: number }>(
        `SELECT lessons_paid, lessons_used FROM individual_balances WHERE student_id = $1`,
        [student_id]
      );
      const remaining = balance ? balance.lessons_paid - balance.lessons_used : 0;
      if (remaining > 0) {
        result.set(student_id, { status: 'paid', label: 'Оплачено' });
      } else {
        result.set(student_id, { status: 'unpaid', label: 'Не оплачено' });
      }
    }
  }

  return result;
}
