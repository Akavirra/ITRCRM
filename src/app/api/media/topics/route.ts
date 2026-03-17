import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all, run } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const topics = await all<{
    id: number;
    thread_id: string;
    name: string;
    drive_folder_id: string;
    file_count: number;
    created_at: string;
  }>(
    `SELECT t.id, t.thread_id, t.name, t.drive_folder_id, t.created_at,
            COUNT(f.id)::int AS file_count
     FROM media_topics t
     LEFT JOIN media_files f ON f.topic_id = t.id
     GROUP BY t.id
     ORDER BY t.name`
  );

  return NextResponse.json(topics);
}

// PATCH /api/media/topics — rename a topic
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id, name } = await request.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }

  await run('UPDATE media_topics SET name = $1 WHERE id = $2', [name.trim(), id]);
  return NextResponse.json({ ok: true });
}
