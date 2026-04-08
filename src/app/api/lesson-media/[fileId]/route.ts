import { NextRequest, NextResponse } from 'next/server';
import { fetchDriveFileContent, getDriveFileMetadata } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

function buildCorsHeaders(contentType: string | null, contentLength: string | null, contentRange: string | null) {
  return {
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(contentLength ? { 'Content-Length': contentLength } : {}),
    ...(contentRange ? { 'Content-Range': contentRange } : {}),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const fileId = params.fileId?.trim();
  if (!fileId) {
    return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
  }

  const range = request.headers.get('range');

  try {
    const driveResponse = await fetchDriveFileContent(fileId, range);

    if (!driveResponse.ok) {
      const metadata = await getDriveFileMetadata(fileId).catch(() => null);
      if (!metadata) {
        return NextResponse.json({ error: 'Media file not found' }, { status: 404 });
      }

      return NextResponse.json({ error: 'Unable to stream media file' }, { status: driveResponse.status });
    }

    return new NextResponse(driveResponse.body, {
      status: driveResponse.status,
      headers: buildCorsHeaders(
        driveResponse.headers.get('content-type'),
        driveResponse.headers.get('content-length'),
        driveResponse.headers.get('content-range')
      ),
    });
  } catch (error) {
    console.error('Lesson media stream error:', error);
    return NextResponse.json({ error: 'Unable to stream media file' }, { status: 500 });
  }
}
