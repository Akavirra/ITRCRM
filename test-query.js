const { all } = require('./src/db/neon');
require('dotenv').config({ path: '.env.local' });

async function main() {
  try {
    const res = await all(`
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
    `, ['2026-04-01', '2026-04-13', '2026-04-01', 2, 1, 10]);
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
main();
