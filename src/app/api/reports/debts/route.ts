import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, getAccessibleGroupIds } from '@/lib/api-utils';
import { getStudentsWithDebt, getTotalDebtForMonth } from '@/lib/students';

export const dynamic = 'force-dynamic';

// GET /api/reports/debts - Debts report
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().substring(0, 7) + '-01';
  const format = searchParams.get('format') || 'json';
  
  // Teachers can only see their own groups
  const accessibleGroups = await getAccessibleGroupIds(user);
  
  const debtors = await getStudentsWithDebt(month);
  
  // Filter by accessible groups for teachers
  const filteredDebtors = user.role === 'admin' 
    ? debtors 
    : debtors.filter(d => accessibleGroups.includes(d.group_id));
  
  const totalDebt = filteredDebtors.reduce((sum, d) => sum + d.debt, 0);
  
  if (format === 'csv') {
    const headers = ['student_id', 'student_name', 'phone', 'parent_name', 'parent_phone', 'group_title', 'monthly_price', 'paid_amount', 'debt'];
    const csvRows = [headers.join(',')];
    
    for (const d of filteredDebtors) {
      csvRows.push([
        d.id,
        `"${d.full_name}"`,
        `"${d.phone || ''}"`,
        `"${d.parent_name || ''}"`,
        `"${d.parent_phone || ''}"`,
        `"${d.group_title}"`,
        d.monthly_price,
        d.paid_amount,
        d.debt
      ].join(','));
    }
    
    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="debts_report.csv"',
      },
    });
  }
  
  return NextResponse.json({ 
    month,
    totalDebt,
    studentsCount: filteredDebtors.length,
    debtors: filteredDebtors 
  });
}