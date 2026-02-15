import { run, get, all } from '@/db';

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
export function getPaymentsForGroupMonth(
  groupId: number,
  month: string
): PaymentWithDetails[] {
  return all<PaymentWithDetails>(
    `SELECT p.*, s.full_name as student_name, g.title as group_title, u.name as created_by_name
     FROM payments p
     JOIN students s ON p.student_id = s.id
     JOIN groups g ON p.group_id = g.id
     JOIN users u ON p.created_by = u.id
     WHERE p.group_id = ? AND p.month = ?
     ORDER BY s.full_name`,
    [groupId, month]
  );
}

// Get payment status for all students in a group for a month
export function getPaymentStatusForGroupMonth(
  groupId: number,
  month: string
): Array<{
  student_id: number;
  student_name: string;
  student_phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  monthly_price: number;
  total_paid: number;
  debt: number;
  payments: Payment[];
}> {
  // Get group's monthly price
  const group = get<{ monthly_price: number }>(
    `SELECT monthly_price FROM groups WHERE id = ?`,
    [groupId]
  );
  
  const monthlyPrice = group?.monthly_price || 0;
  
  // Get all students in the group with their payments
  const students = all<{
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
     WHERE sg.group_id = ? AND sg.is_active = 1 AND s.is_active = 1
     ORDER BY s.full_name`,
    [groupId]
  );
  
  return students.map(student => {
    const payments = all<Payment>(
      `SELECT * FROM payments WHERE student_id = ? AND group_id = ? AND month = ?`,
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
  });
}

// Create payment
export function createPayment(
  studentId: number,
  groupId: number,
  month: string,
  amount: number,
  method: PaymentMethod,
  createdBy: number,
  note?: string,
  paidAt?: string
): number {
  const result = run(
    `INSERT INTO payments (student_id, group_id, month, amount, method, paid_at, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  
  return Number(result.lastInsertRowid);
}

// Update payment
export function updatePayment(
  id: number,
  amount: number,
  method: PaymentMethod,
  note?: string,
  paidAt?: string
): void {
  run(
    `UPDATE payments SET amount = ?, method = ?, paid_at = ?, note = ? WHERE id = ?`,
    [amount, method, paidAt || new Date().toISOString().replace('T', ' ').substring(0, 19), note || null, id]
  );
}

// Delete payment
export function deletePayment(id: number): void {
  run(`DELETE FROM payments WHERE id = ?`, [id]);
}

// Get payment by ID
export function getPaymentById(id: number): Payment | null {
  const payment = get<Payment>(`SELECT * FROM payments WHERE id = ?`, [id]);
  return payment || null;
}

// Get payment statistics for a period
export function getPaymentStats(
  startDate?: string,
  endDate?: string,
  groupId?: number,
  courseId?: number
): {
  total_amount: number;
  cash_amount: number;
  account_amount: number;
  payments_count: number;
} {
  let sql = `SELECT 
    SUM(p.amount) as total_amount,
    SUM(CASE WHEN p.method = 'cash' THEN p.amount ELSE 0 END) as cash_amount,
    SUM(CASE WHEN p.method = 'account' THEN p.amount ELSE 0 END) as account_amount,
    COUNT(*) as payments_count
   FROM payments p
   JOIN groups g ON p.group_id = g.id
   WHERE 1=1`;
  
  const params: (string | number)[] = [];
  
  if (startDate) {
    sql += ` AND p.month >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND p.month <= ?`;
    params.push(endDate);
  }
  
  if (groupId) {
    sql += ` AND p.group_id = ?`;
    params.push(groupId);
  }
  
  if (courseId) {
    sql += ` AND g.course_id = ?`;
    params.push(courseId);
  }
  
  const result = get<{
    total_amount: number;
    cash_amount: number;
    account_amount: number;
    payments_count: number;
  }>(sql, params);
  
  return result || { total_amount: 0, cash_amount: 0, account_amount: 0, payments_count: 0 };
}

// Get all payments for export
export function getPaymentsForExport(
  startDate?: string,
  endDate?: string,
  groupId?: number,
  courseId?: number
): PaymentWithDetails[] {
  let sql = `SELECT p.*, s.full_name as student_name, g.title as group_title, u.name as created_by_name
             FROM payments p
             JOIN students s ON p.student_id = s.id
             JOIN groups g ON p.group_id = g.id
             JOIN users u ON p.created_by = u.id
             WHERE 1=1`;
  
  const params: (string | number)[] = [];
  
  if (startDate) {
    sql += ` AND p.month >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ` AND p.month <= ?`;
    params.push(endDate);
  }
  
  if (groupId) {
    sql += ` AND p.group_id = ?`;
    params.push(groupId);
  }
  
  if (courseId) {
    sql += ` AND g.course_id = ?`;
    params.push(courseId);
  }
  
  sql += ` ORDER BY p.month DESC, s.full_name`;
  
  return all<PaymentWithDetails>(sql, params);
}