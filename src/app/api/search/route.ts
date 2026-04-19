import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';
import { getOrSetServerCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

const SEARCH_CACHE_TTL_MS = 20 * 1000;

interface SearchResult {
  id: number;
  public_id?: string;
  avatar_url?: string | null;
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

  const normalizedQuery = q.toLowerCase();
  const term = `%${q}%`;
  const prefixTerm = `${q}%`;

  try {
    const searchPayload = await getOrSetServerCache(
      `search:global:${normalizedQuery}`,
      SEARCH_CACHE_TTL_MS,
      async () => {
        const [students, groups, courses, teachers] = await Promise.all([
          all<{
            id: number;
            public_id: string;
            full_name: string;
            parent_name: string | null;
            parent_phone: string | null;
            photo: string | null;
            study_status: string;
          }>(
            `WITH matched_students AS (
               SELECT id, public_id, full_name, parent_name, parent_phone, photo
               FROM students
               WHERE is_active = TRUE
                 AND (full_name ILIKE $1 OR parent_name ILIKE $2 OR parent_phone ILIKE $3)
               ORDER BY
                 CASE
                   WHEN full_name ILIKE $5 THEN 0
                   WHEN parent_name ILIKE $5 THEN 1
                   WHEN parent_phone ILIKE $5 THEN 2
                   ELSE 3
                 END,
                 full_name
               LIMIT 5
             )
             SELECT
               ms.*,
               CASE
                 WHEN EXISTS (
                   SELECT 1
                   FROM student_groups sg
                   WHERE sg.student_id = ms.id
                     AND sg.is_active = TRUE
                 ) THEN 'studying'
                 ELSE 'not_studying'
               END as study_status
             FROM matched_students ms
             ORDER BY ms.full_name`,
            [term, term, term, prefixTerm]
          ),

          all<{
            id: number;
            public_id: string;
            title: string;
            course_title: string;
            teacher_name: string;
            students_count: number;
          }>(
            `WITH matched_groups AS (
               SELECT g.id, g.public_id, g.title, c.title as course_title, u.name as teacher_name
               FROM groups g
               JOIN courses c ON g.course_id = c.id
               JOIN users u ON g.teacher_id = u.id
               WHERE g.is_active = TRUE
                 AND (g.title ILIKE $1 OR c.title ILIKE $2)
               ORDER BY
                 CASE
                   WHEN g.title ILIKE $3 THEN 0
                   WHEN c.title ILIKE $3 THEN 1
                   ELSE 2
                 END,
                 g.title
               LIMIT 5
             )
             SELECT
               mg.*,
               (
                 SELECT COUNT(*)
                 FROM student_groups sg
                 WHERE sg.group_id = mg.id
                   AND sg.is_active = TRUE
               ) as students_count
             FROM matched_groups mg
             ORDER BY mg.title`,
            [term, term, prefixTerm]
          ),

          all<{
            id: number;
            public_id: string;
            title: string;
            description: string | null;
            groups_count: number;
          }>(
            `WITH matched_courses AS (
               SELECT c.id, c.public_id, c.title, c.description
               FROM courses c
               WHERE c.is_active = TRUE
                 AND (c.title ILIKE $1 OR c.description ILIKE $2)
               ORDER BY
                 CASE
                   WHEN c.title ILIKE $3 THEN 0
                   ELSE 1
                 END,
                 c.title
               LIMIT 5
             )
             SELECT
               mc.*,
               (
                 SELECT COUNT(*)
                 FROM groups g
                 WHERE g.course_id = mc.id
                   AND g.is_active = TRUE
               ) as groups_count
             FROM matched_courses mc
             ORDER BY mc.title`,
            [term, term, prefixTerm]
          ),

          all<{
            id: number;
            public_id: string;
            name: string;
            email: string;
            phone: string | null;
            photo_url: string | null;
            active_groups_count: number;
          }>(
            `WITH matched_teachers AS (
               SELECT u.id, u.public_id, u.name, u.email, u.phone, u.photo_url
               FROM users u
               WHERE u.role = 'teacher'
                 AND u.is_active = TRUE
                 AND (u.name ILIKE $1 OR u.email ILIKE $2 OR u.phone ILIKE $3)
               ORDER BY
                 CASE
                   WHEN u.name ILIKE $4 THEN 0
                   WHEN u.email ILIKE $4 THEN 1
                   WHEN u.phone ILIKE $4 THEN 2
                   ELSE 3
                 END,
                 u.name
               LIMIT 5
             )
             SELECT
               mt.*,
               (
                 SELECT COUNT(*)
                 FROM groups g
                 WHERE g.teacher_id = mt.id
                   AND g.status = 'active'
               ) as active_groups_count
             FROM matched_teachers mt
             ORDER BY mt.name`,
            [term, term, term, prefixTerm]
          ),
        ]);

        const results: SearchResult[] = [];

        for (const s of students) {
          results.push({
            id: s.id,
            public_id: s.public_id,
            avatar_url: s.photo,
            title: s.full_name,
            subtitle: [s.parent_phone, s.parent_name].filter(Boolean).join(' · ') || (s.study_status === 'studying' ? 'Навчається' : 'Не навчається'),
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
            avatar_url: t.photo_url,
            title: t.name,
            subtitle: [t.email, t.phone, `${t.active_groups_count} груп`].filter(Boolean).join(' · '),
            type: 'teacher',
          });
        }

        return {
          results,
          counts: {
            students: students.length,
            groups: groups.length,
            courses: courses.length,
            teachers: teachers.length,
          },
        };
      }
    );

    return NextResponse.json(searchPayload);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Помилка пошуку' }, { status: 500 });
  }
}
