import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get('topic_id');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let p = 1;

  if (topicId) {
    conditions.push(`f.topic_id = $${p++}`);
    params.push(parseInt(topicId));
  }
  if (search) {
    conditions.push(`f.file_name ILIKE $${p++}`);
    params.push(`%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const files = await all<{
    id: number;
    topic_id: number;
    topic_name: string;
    file_name: string;
    file_type: string;
    file_size: number;
    drive_file_id: string;
    drive_view_url: string;
    drive_download_url: string;
    uploaded_by_name: string;
    created_at: string;
    media_width: number | null;
    media_height: number | null;
  }>(
    `SELECT f.id, f.topic_id, t.name AS topic_name,
            f.file_name, f.file_type, f.file_size,
            f.drive_file_id, f.drive_view_url, f.drive_download_url,
            f.uploaded_by_name, f.created_at,
            f.media_width, f.media_height
     FROM media_files f
     LEFT JOIN media_topics t ON t.id = f.topic_id
     ${where}
     ORDER BY f.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return NextResponse.json({ files, page, limit });
}
