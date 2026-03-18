export interface PhotosMediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    creationTime: string;
    width?: string;
    height?: string;
    photo?: Record<string, unknown>;
    video?: { fps?: number; status?: string };
  };
  filename: string;
}

async function getPhotosAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to get Photos access token: ' + JSON.stringify(data));
  }

  return data.access_token as string;
}

export async function searchPhotosByDate(dateStr: string): Promise<PhotosMediaItem[]> {
  const [year, month, day] = dateStr.split('-').map(Number);
  const token = await getPhotosAccessToken();

  const items: PhotosMediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const body: Record<string, unknown> = {
      pageSize: 100,
      filters: {
        dateFilter: {
          ranges: [{ startDate: { year, month, day }, endDate: { year, month, day } }],
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Photos API ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (data.mediaItems) items.push(...(data.mediaItems as PhotosMediaItem[]));
    pageToken = data.nextPageToken as string | undefined;
  } while (pageToken);

  return items;
}

export async function listRecentPhotos(pageToken?: string): Promise<{
  items: PhotosMediaItem[];
  nextPageToken?: string;
}> {
  const token = await getPhotosAccessToken();

  const url = new URL('https://photoslibrary.googleapis.com/v1/mediaItems');
  url.searchParams.set('pageSize', '50');
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Photos API ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    items: (data.mediaItems ?? []) as PhotosMediaItem[],
    nextPageToken: data.nextPageToken as string | undefined,
  };
}
