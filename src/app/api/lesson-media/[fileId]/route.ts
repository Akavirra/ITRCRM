import { NextRequest, NextResponse } from 'next/server';
import { fetchDriveFileContent, getDriveFileMetadata } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

const PASSTHROUGH_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-encoding',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
];

function buildStreamHeaders(sourceHeaders: Headers): Headers {
  const headers = new Headers();

  for (const headerName of PASSTHROUGH_HEADERS) {
    const value = sourceHeaders.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  if (!headers.has('accept-ranges')) {
    headers.set('accept-ranges', 'bytes');
  }

  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'private, max-age=300');
  }

  return headers;
}

async function forwardDriveMediaResponse(fileId: string, range?: string | null) {
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
    headers: buildStreamHeaders(driveResponse.headers),
  });
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
    return await forwardDriveMediaResponse(fileId, range);
  } catch (error) {
    console.error('Lesson media stream error:', error);
    return NextResponse.json({ error: 'Unable to stream media file' }, { status: 500 });
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const fileId = params.fileId?.trim();
  if (!fileId) {
    return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
  }

  try {
    const driveResponse = await fetchDriveFileContent(fileId, request.headers.get('range'));

    if (!driveResponse.ok) {
      return NextResponse.json({ error: 'Unable to inspect media file' }, { status: driveResponse.status });
    }

    return new NextResponse(null, {
      status: driveResponse.status,
      headers: buildStreamHeaders(driveResponse.headers),
    });
  } catch (error) {
    console.error('Lesson media HEAD error:', error);
    return NextResponse.json({ error: 'Unable to inspect media file' }, { status: 500 });
  }
}
