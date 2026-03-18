import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  // Get access token from refresh token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'Failed to get access token', details: tokenData });
  }

  // Check what scopes this access token actually has
  const infoRes = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${tokenData.access_token}`
  );
  const info = await infoRes.json();

  // Try actual Photos Library API call with this token
  const photosRes = await fetch(
    'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=1',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  const photosData = await photosRes.json();

  return NextResponse.json({
    scope: info.scope,
    has_photos: (info.scope ?? '').includes('photoslibrary'),
    has_drive: (info.scope ?? '').includes('drive'),
    refresh_token_prefix: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.slice(0, 10) + '...',
    photos_api_status: photosRes.status,
    photos_api_result: photosData,
  });
}
