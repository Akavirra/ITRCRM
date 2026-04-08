import { NextRequest, NextResponse } from 'next/server';
import { get } from '@/db';
import { assertInternalApiSecret } from '@/lib/upload-service';
import { ensureLessonPhotoFolder } from '@/lib/lesson-photos';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!assertInternalApiSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const lessonId = parseInt(params.id, 10);
  if (Number.isNaN(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
  }

  const lesson = await get<{
    lessonId: number;
    groupId: number | null;
    courseTitle: string | null;
    groupTitle: string | null;
    lessonDate: string | null;
    topic: string | null;
  }>(
    `SELECT
       l.id as "lessonId",
       l.group_id as "groupId",
       l.lesson_date as "lessonDate",
       l.topic as topic,
       c.title as "courseTitle",
       g.title as "groupTitle"
     FROM lessons l
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     WHERE l.id = $1`,
    [lessonId]
  );

  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  if (lesson.groupId === null) {
    return NextResponse.json({ error: 'Media uploads are available only for group lessons' }, { status: 400 });
  }

  const photoFolder = await ensureLessonPhotoFolder(lessonId);
  if (!photoFolder) {
    return NextResponse.json({ error: 'Lesson media folder is unavailable' }, { status: 400 });
  }

  return NextResponse.json({
    lessonId: lesson.lessonId,
    courseTitle: lesson.courseTitle,
    groupTitle: lesson.groupTitle,
    lessonDate: lesson.lessonDate,
    topic: lesson.topic,
    folderId: photoFolder.id,
    folderName: photoFolder.name,
    folderUrl: photoFolder.url,
  });
}
