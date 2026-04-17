import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, notFound } from '@/lib/api-utils';
import { get, run } from '@/db';
import { deleteFileFromDrive } from '@/lib/google-drive';
import { safeAddAuditEvent, toAuditBadge } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const file = await get<{
    id: number;
    topic_id: number | null;
    topic_name: string | null;
    file_name: string;
    drive_file_id: string;
  }>(
    `SELECT f.id, f.topic_id, t.name AS topic_name, f.file_name, f.drive_file_id
     FROM media_files f
     LEFT JOIN media_topics t ON t.id = f.topic_id
     WHERE f.id = $1`,
    [params.id]
  );
  if (!file) return notFound('File not found');

  await deleteFileFromDrive(file.drive_file_id);
  await run('DELETE FROM media_files WHERE id = $1', [file.id]);
  await safeAddAuditEvent({
    entityType: 'media',
    entityId: file.id,
    entityTitle: file.file_name,
    eventType: 'media_file_deleted',
    eventBadge: toAuditBadge('media_file_deleted'),
    description: `Видалено медіафайл "${file.file_name}"`,
    userId: user.id,
    userName: user.name,
    metadata: {
      topicId: file.topic_id,
      topicName: file.topic_name,
    },
  });

  return NextResponse.json({ ok: true });
}
