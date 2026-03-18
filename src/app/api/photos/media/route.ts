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
    console.error('[photos/media] ERROR:', message);
    // Return full error for debugging
    return NextResponse.json({ error: message, items: [] }, { status: 200 });
  }
}
