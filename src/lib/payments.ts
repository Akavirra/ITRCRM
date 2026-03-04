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

// Get payment status for all students in a group for a month
export async function getPaymentStatusForGroupMonth(
  groupId: number,
  month: string
): Promise<Array<{
  student_id: number;
  student_name: string;
  student_phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  monthly_price: number;
  total_paid: number;
  debt: number;
  payments: Payment[];
}>> {
  // Get group's monthly price
  const group = await get<{ monthly_price: number }>(
    `SELECT monthly_price FROM groups WHERE id = $1`,
    [groupId]
  );
  
  const monthlyPrice = group?.monthly_price || 0;
  
  // Get all students in the group with their payments
  const students = await all<{
    student_id: number;
    student_name: string;
    student_phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
  }>(
    `SELECT s.id as student_id, s.full_name as student_name, s.phone as student_phone,
            s.parent_name, s.parent_phone
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
    
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    
    return {
      ...student,
      monthly_price: monthlyPrice,
      total_paid: totalPaid,
      debt: Math.max(0, monthlyPrice - totalPaid),
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
