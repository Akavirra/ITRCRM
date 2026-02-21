import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, getAccessibleGroupIds } from '@/lib/api-utils';
import { getGroupAttendanceStats, getStudentAttendanceStats } from '@/lib/attendance';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  accessDenied: 'Недостатньо прав доступу',
};

// GET /api/reports/attendance - Attendance report
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');
  const studentId = searchParams.get('studentId');
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const format = searchParams.get('format') || 'json';
  
  // Teachers can only see their own groups
  const accessibleGroups = await getAccessibleGroupIds(user);
  
  if (groupId && !accessibleGroups.includes(parseInt(groupId))) {
    return NextResponse.json({ error: ERROR_MESSAGES.accessDenied }, { status: 403 });
  }
  
  let report: any[] = [];
  
  if (studentId) {
    // Report for a specific student
    const stats = await getStudentAttendanceStats(parseInt(studentId), groupId ? parseInt(groupId) : undefined, startDate, endDate);
    report = [{ student_id: parseInt(studentId), ...stats }];
  } else if (groupId) {
    // Report for a specific group
    report = await getGroupAttendanceStats(parseInt(groupId), startDate, endDate);
  } else {
    // Report for all accessible groups
    for (const gId of accessibleGroups) {
      const groupStats = await getGroupAttendanceStats(gId, startDate, endDate);
      report.push(...groupStats);
    }
  }
  
  if (format === 'csv') {
    const headers = ['student_id', 'student_name', 'total', 'present', 'absent', 'makeup_planned', 'makeup_done', 'attendance_rate'];
    const csvRows = [headers.join(',')];
    
    for (const row of report) {
      csvRows.push([
        row.student_id,
        `"${row.student_name}"`,
        row.total,
        row.present,
        row.absent,
        row.makeup_planned,
        row.makeup_done,
        row.attendance_rate
      ].join(','));
    }
    
    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="attendance_report.csv"',
      },
    });
  }
  
  return NextResponse.json({ report });
}
