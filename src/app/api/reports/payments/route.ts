import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, getAccessibleGroupIds } from '@/lib/api-utils';
import { getPaymentStats, getPaymentsForExport } from '@/lib/payments';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  accessDenied: 'Недостатньо прав доступу',
};

// GET /api/reports/payments - Payments report
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');
  const courseId = searchParams.get('courseId');
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const format = searchParams.get('format') || 'json';
  
  // Teachers can only see their own groups
  const accessibleGroups = await getAccessibleGroupIds(user);
  
  if (groupId && !accessibleGroups.includes(parseInt(groupId))) {
    return NextResponse.json({ error: ERROR_MESSAGES.accessDenied }, { status: 403 });
  }
  
  const stats = await getPaymentStats(startDate, endDate, groupId ? parseInt(groupId) : undefined, courseId ? parseInt(courseId) : undefined);
  
  if (format === 'csv') {
    const payments = await getPaymentsForExport(startDate, endDate, groupId ? parseInt(groupId) : undefined, courseId ? parseInt(courseId) : undefined);
    
    const headers = ['id', 'student_name', 'group_title', 'month', 'amount', 'method', 'paid_at', 'note', 'created_by_name'];
    const csvRows = [headers.join(',')];
    
    for (const p of payments) {
      csvRows.push([
        p.id,
        `"${p.student_name}"`,
        `"${p.group_title}"`,
        p.month,
        p.amount,
        p.method,
        p.paid_at,
        `"${p.note || ''}"`,
        `"${p.created_by_name}"`
      ].join(','));
    }
    
    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="payments_report.csv"',
      },
    });
  }
  
  return NextResponse.json({ stats });
}
