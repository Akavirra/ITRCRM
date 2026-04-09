import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

interface LessonFolderRow {
  course_id: number | null;
  course_title: string;
  group_id: number | null;
  group_title: string;
  lesson_id: number;
  lesson_date: string | null;
  lesson_folder_id: string;
  lesson_folder_name: string;
  drive_url: string;
  file_count: number;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const rows = await all<LessonFolderRow>(
    `SELECT
       COALESCE(l.course_id, g.course_id) AS course_id,
       COALESCE(c.title, 'Без курсу') AS course_title,
       g.id AS group_id,
       COALESCE(g.title, 'Без групи') AS group_title,
       l.id AS lesson_id,
       l.lesson_date,
       lpf.lesson_folder_id,
       lpf.lesson_folder_name,
       lpf.drive_url,
       COUNT(lfi.id)::int AS file_count
     FROM lesson_photo_folders lpf
     JOIN lessons l ON l.id = lpf.lesson_id
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN lesson_photo_files lfi ON lfi.lesson_id = l.id
     GROUP BY
       COALESCE(l.course_id, g.course_id),
       COALESCE(c.title, 'Без курсу'),
       g.id,
       COALESCE(g.title, 'Без групи'),
       l.id,
       l.lesson_date,
       lpf.lesson_folder_id,
       lpf.lesson_folder_name,
       lpf.drive_url
     ORDER BY
       COALESCE(c.title, 'Без курсу') ASC,
       COALESCE(g.title, 'Без групи') ASC,
       l.lesson_date DESC,
       lpf.lesson_folder_name ASC`
  );

  const courses = new Map<number | string, {
    id: number | null;
    title: string;
    fileCount: number;
    lessonCount: number;
    groups: Map<number | string, {
      id: number | null;
      title: string;
      fileCount: number;
      lessonCount: number;
      lessons: Array<{
        id: number;
        lessonDate: string | null;
        folderId: string;
        folderName: string;
        driveUrl: string;
        fileCount: number;
      }>;
    }>;
  }>();

  for (const row of rows) {
    const courseKey = row.course_id ?? `course-${row.course_title}`;
    let course = courses.get(courseKey);
    if (!course) {
      course = {
        id: row.course_id,
        title: row.course_title,
        fileCount: 0,
        lessonCount: 0,
        groups: new Map(),
      };
      courses.set(courseKey, course);
    }

    course.fileCount += row.file_count;
    course.lessonCount += 1;

    const groupKey = row.group_id ?? `group-${row.course_title}-${row.group_title}`;
    let group = course.groups.get(groupKey);
    if (!group) {
      group = {
        id: row.group_id,
        title: row.group_title,
        fileCount: 0,
        lessonCount: 0,
        lessons: [],
      };
      course.groups.set(groupKey, group);
    }

    group.fileCount += row.file_count;
    group.lessonCount += 1;
    group.lessons.push({
      id: row.lesson_id,
      lessonDate: row.lesson_date,
      folderId: row.lesson_folder_id,
      folderName: row.lesson_folder_name,
      driveUrl: row.drive_url,
      fileCount: row.file_count,
    });
  }

  return NextResponse.json({
    courses: Array.from(courses.values()).map((course) => ({
      id: course.id,
      title: course.title,
      fileCount: course.fileCount,
      lessonCount: course.lessonCount,
      groups: Array.from(course.groups.values()).map((group) => ({
        id: group.id,
        title: group.title,
        fileCount: group.fileCount,
        lessonCount: group.lessonCount,
        lessons: group.lessons,
      })),
    })),
  });
}
