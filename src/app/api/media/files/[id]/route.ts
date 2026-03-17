import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, notFound } from '@/lib/api-utils';
import { get, run } from '@/db';
import { deleteFileFromDrive } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const file = await get<{ id: number; drive_file_id: string }>(
    'SELECT id, drive_file_id FROM media_files WHERE id = $1',
    [params.id]
  );
  if (!file) return notFound('File not found');

  await deleteFileFromDrive(file.drive_file_id);
  await run('DELETE FROM media_files WHERE id = $1', [file.id]);

  return NextResponse.json({ ok: true });
}
