import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin } from '@/lib/api-utils';
import { all, get } from '@/db';
import { format, addDays, startOfMonth } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    // For now, only admins see the full dashboard. 
    // Teachers might get a limited view later.
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const firstDayOfMonth = format(startOfMonth(today), 'yyyy-MM-dd');
    
    // 1. Summary Stats
    const statsPromise = Promise.all([
      get<{ count: number }>(`SELECT COUNT(*) as count FROM students WHERE is_active = TRUE`),
      get<{ count: number }>(`SELECT COUNT(*) as count FROM groups WHERE status = 'active' AND is_active = TRUE`),
      get<{ count: number }>(`SELECT COUNT(*) as count FROM lessons WHERE lesson_date = $1 AND status != 'canceled'`, [todayStr]),
      get<{ total: number }>(`SELECT SUM(amount) as total FROM payments WHERE month >= $1`, [firstDayOfMonth])
    ]);

    // 2. Today's Schedule
    const schedulePromise = all(`
      SELECT 
        l.id, l.start_datetime, l.end_datetime, l.status, l.topic,
        g.title as group_title, c.title as course_title, u.name as teacher_name
      FROM lessons l
      LEFT JOIN groups g ON l.group_id = g.id
      LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
      LEFT JOIN users u ON COALESCE(l.teacher_id, g.teacher_id) = u.id
      WHERE l.lesson_date = $1
      ORDER BY l.start_datetime ASC
    `, [todayStr]);

    // 3. Upcoming Birthdays (next 7 days)
    // PostgreSql way to check birthdays ignoring year
    const birthdaysPromise = all(`
      SELECT id, full_name, birth_date, public_id
      FROM students
      WHERE is_active = TRUE 
        AND birth_date IS NOT NULL
        AND (
          TO_CHAR(birth_date, 'MM-DD') BETWEEN TO_CHAR(CURRENT_DATE, 'MM-DD') 
          AND TO_CHAR(CURRENT_DATE + INTERVAL '7 days', 'MM-DD')
        )
      ORDER BY TO_CHAR(birth_date, 'MM-DD') ASC
    `);

    // 4. Recent Activity
    const recentPaymentsPromise = all(`
      SELECT p.amount, p.paid_at, s.full_name as student_name, s.public_id as student_public_id
      FROM payments p
      JOIN students s ON p.student_id = s.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    const recentHistoryPromise = all(`
      SELECT h.action_type, h.action_description, h.created_at, h.user_name, s.full_name as student_name, s.public_id as student_public_id
      FROM student_history h
      JOIN students s ON h.student_id = s.id
      ORDER BY h.created_at DESC
      LIMIT 5
    `);

    const [
      [studentCount, groupCount, lessonCount, revenue],
      todaySchedule,
      upcomingBirthdays,
      recentPayments,
      recentHistory
    ] = await Promise.all([
      statsPromise,
      schedulePromise,
      birthdaysPromise,
      recentPaymentsPromise,
      recentHistoryPromise
    ]);

    return NextResponse.json({
      stats: {
        activeStudents: studentCount?.count || 0,
        activeGroups: groupCount?.count || 0,
        todayLessons: lessonCount?.count || 0,
        monthlyRevenue: revenue?.total || 0
      },
      todaySchedule,
      upcomingBirthdays,
      recentPayments,
      recentHistory
    });

  } catch (error) {
    console.error('Dashboard stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
