import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

interface SearchResult {
  id: number;
  public_id?: string;
  title: string;
  subtitle: string;
  type: 'student' | 'group' | 'course' | 'teacher';
}

// GET /api/search?q=...
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const term = `%${q}%`;

  try {
    // Run all searches in parallel for speed
    const [students, groups, courses, teachers] = await Promise.all([
      // Students
      all<{ id: number; public_id: string; full_name: string; phone: string | null; parent_name: string | null; study_status: string }>(
        `SELECT id, public_id, full_name, phone, parent_name,
           CASE WHEN (SELECT COUNT(*) FROM student_groups WHERE student_id = students.id AND is_active = TRUE) > 0
                THEN 'studying' ELSE 'not_studying' END as study_status
         FROM students
         WHERE is_active = TRUE
           AND (full_name ILIKE $1 OR phone ILIKE $2 OR parent_name ILIKE $3 OR parent_phone ILIKE $4)
         ORDER BY full_name
         LIMIT 5`,
        [term, term, term, term]
      ),

      // Groups (with course title and teacher name)
      all<{ id: number; public_id: string; title: string; course_title: string; teacher_name: string; students_count: number }>(
        `SELECT g.id, g.public_id, g.title, c.title as course_title, u.name as teacher_name,
           (SELECT COUNT(*) FROM student_groups sg WHERE sg.group_id = g.id AND sg.is_active = TRUE) as students_count
         FROM groups g
         JOIN courses c ON g.course_id = c.id
         JOIN users u ON g.teacher_id = u.id
         WHERE g.is_active = TRUE
           AND (g.title ILIKE $1 OR c.title ILIKE $2)
         ORDER BY g.title
         LIMIT 5`,
        [term, term]
      ),

      // Courses
      all<{ id: number; public_id: string; title: string; description: string | null; groups_count: number }>(
        `SELECT c.id, c.public_id, c.title, c.description,
           (SELECT COUNT(*) FROM groups WHERE course_id = c.id AND is_active = TRUE) as groups_count
         FROM courses c
         WHERE c.is_active = TRUE
           AND (c.title ILIKE $1 OR c.description ILIKE $2)
         ORDER BY c.title
         LIMIT 5`,
        [term, term]
      ),

      // Teachers
      all<{ id: number; public_id: string; name: string; email: string; phone: string | null; active_groups_count: number }>(
        `SELECT u.id, u.public_id, u.name, u.email, u.phone,
           (SELECT COUNT(*) FROM groups WHERE teacher_id = u.id AND status = 'active') as active_groups_count
         FROM users u
         WHERE u.role = 'teacher' AND u.is_active = TRUE
           AND (u.name ILIKE $1 OR u.email ILIKE $2 OR u.phone ILIKE $3)
         ORDER BY u.name
         LIMIT 5`,
        [term, term, term]
      ),
    ]);

    // Map to unified result format
    const results: SearchResult[] = [];

    for (const s of students) {
      results.push({
        id: s.id,
        public_id: s.public_id,
        title: s.full_name,
        subtitle: [s.phone, s.parent_name].filter(Boolean).join(' · ') || (s.study_status === 'studying' ? 'Навчається' : 'Не навчається'),
        type: 'student',
      });
    }

    for (const g of groups) {
      results.push({
        id: g.id,
        public_id: g.public_id,
        title: g.title,
        subtitle: `${g.course_title} · ${g.teacher_name} · ${g.students_count} учн.`,
        type: 'group',
      });
    }

    for (const c of courses) {
      results.push({
        id: c.id,
        public_id: c.public_id,
        title: c.title,
        subtitle: c.description ? c.description.slice(0, 80) : `${c.groups_count} груп`,
        type: 'course',
      });
    }

    for (const t of teachers) {
      results.push({
        id: t.id,
        public_id: t.public_id,
        title: t.name,
        subtitle: [t.email, t.phone, `${t.active_groups_count} груп`].filter(Boolean).join(' · '),
        type: 'teacher',
      });
    }

    return NextResponse.json({
      results,
      counts: {
        students: students.length,
        groups: groups.length,
        courses: courses.length,
        teachers: teachers.length,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Помилка пошуку' }, { status: 500 });
  }
}
