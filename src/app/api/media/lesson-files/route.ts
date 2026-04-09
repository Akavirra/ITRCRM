import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';
import { getDriveDownloadUrl, getDriveThumbnailUrl, getDriveViewUrl } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

interface LessonMediaRow {
  id: number;
  lesson_id: number;
  drive_file_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by_name: string | null;
  created_at: string;
  course_id: number | null;
  course_title: string;
  group_id: number | null;
  group_title: string;
  lesson_folder_name: string;
  lesson_folder_id: string;
  lesson_folder_url: string;
}

function detectFileType(mimeType: string | null, fileName: string): string {
  const mime = (mimeType || '').toLowerCase();
  const lowerFileName = fileName.toLowerCase();

  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|tiff?)$/i.test(lowerFileName)) return 'photo';
  if (/\.(mp4|mov|avi|mkv|webm|m4v|3gp|wmv|flv|ts)$/i.test(lowerFileName)) return 'video';
  if (/\.(mp3|wav|ogg|flac|aac|m4a|wma|opus|oga)$/i.test(lowerFileName)) return 'audio';
  return 'document';
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get('lesson_id');
  const groupId = searchParams.get('group_id');
  const courseId = searchParams.get('course_id');
  const search = searchParams.get('search')?.trim();

  const conditions: string[] = [];
  const params: Array<number | string> = [];
  let p = 1;

  if (lessonId) {
    conditions.push(`lfi.lesson_id = $${p++}`);
    params.push(Number(lessonId));
  } else if (groupId) {
    conditions.push(`g.id = $${p++}`);
    params.push(Number(groupId));
  } else if (courseId) {
    conditions.push(`COALESCE(l.course_id, g.course_id) = $${p++}`);
    params.push(Number(courseId));
  }

  if (search) {
    conditions.push(`lfi.file_name ILIKE $${p++}`);
    params.push(`%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await all<LessonMediaRow>(
    `SELECT
       lfi.id,
       lfi.lesson_id,
       lfi.drive_file_id,
       lfi.file_name,
       lfi.mime_type,
       lfi.file_size,
       lfi.uploaded_by_name,
       lfi.created_at,
       COALESCE(l.course_id, g.course_id) AS course_id,
       COALESCE(c.title, 'Без курсу') AS course_title,
       g.id AS group_id,
       COALESCE(g.title, 'Без групи') AS group_title,
       lpf.lesson_folder_name,
       lpf.lesson_folder_id,
       lpf.drive_url AS lesson_folder_url
     FROM lesson_photo_files lfi
     JOIN lessons l ON l.id = lfi.lesson_id
     LEFT JOIN groups g ON l.group_id = g.id
     LEFT JOIN courses c ON COALESCE(l.course_id, g.course_id) = c.id
     LEFT JOIN lesson_photo_folders lpf ON lpf.lesson_id = l.id
     ${where}
     ORDER BY lfi.created_at DESC, lfi.id DESC`,
    params
  );

  return NextResponse.json({
    files: rows.map((row) => ({
      id: row.id,
      topic_id: row.lesson_id,
      topic_name: row.lesson_folder_name,
      file_name: row.file_name,
      file_type: detectFileType(row.mime_type, row.file_name),
      file_size: row.file_size ?? 0,
      drive_file_id: row.drive_file_id,
      drive_view_url: getDriveViewUrl(row.drive_file_id),
      drive_download_url: getDriveDownloadUrl(row.drive_file_id),
      uploaded_by_name: row.uploaded_by_name,
      created_at: row.created_at,
      media_width: null,
      media_height: null,
      source: 'lesson',
      lesson_id: row.lesson_id,
      course_id: row.course_id,
      course_title: row.course_title,
      group_id: row.group_id,
      group_title: row.group_title,
      folder_id: row.lesson_folder_id,
      folder_url: row.lesson_folder_url,
      thumbnail_url: getDriveThumbnailUrl(row.drive_file_id),
    })),
  });
}
