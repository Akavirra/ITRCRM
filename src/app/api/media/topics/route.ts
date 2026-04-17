import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { all, run, get } from '@/db';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

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

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { id, name } = await request.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }

  const topic = await get<{ id: number; name: string; thread_id: string }>(
    'SELECT id, name, thread_id FROM media_topics WHERE id = $1',
    [id]
  );
  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  const nextName = name.trim();
  await run('UPDATE media_topics SET name = $1 WHERE id = $2', [nextName, id]);
  await safeAddAuditEvent({
    entityType: 'media',
    entityId: topic.id,
    entityTitle: nextName,
    eventType: 'media_topic_renamed',
    eventBadge: toAuditBadge('media_topic_renamed'),
    description: `Перейменовано медіа-топік "${topic.name}" на "${nextName}"`,
    userId: user.id,
    userName: user.name,
    metadata: {
      threadId: topic.thread_id,
      previousName: topic.name,
      nextName,
    },
  });

  return NextResponse.json({ ok: true });
}
