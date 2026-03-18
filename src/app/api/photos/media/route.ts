import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { searchPhotosByDate, listRecentPhotos } from '@/lib/google-photos';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const pageToken = searchParams.get('page') ?? undefined;

  try {
    if (date) {
      const items = await searchPhotosByDate(date);
      return NextResponse.json({ items });
    } else {
      const result = await listRecentPhotos(pageToken);
      return NextResponse.json(result);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // 401/403 means the refresh token doesn't have photoslibrary scope
    if (message.includes('401') || message.includes('403')) {
      return NextResponse.json({ error: 'no_photos_access', items: [] }, { status: 200 });
    }
    console.error('[photos/media]', message);
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
