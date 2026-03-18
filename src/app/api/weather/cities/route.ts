import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

interface GeoResult {
  name: string;
  local_names?: Record<string, string>;
  country: string;
  state?: string;
}

interface CitySuggestion {
  name: string;       // Ukrainian name (or fallback)
  nameEn: string;     // English name for the API query
  country: string;
  state?: string;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENWEATHERMAP_API_KEY не налаштований' }, { status: 503 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return NextResponse.json([]);

    const data: GeoResult[] = await res.json();

    const suggestions: CitySuggestion[] = data.map(item => ({
      name: item.local_names?.uk || item.local_names?.ru || item.name,
      nameEn: item.name,
      country: item.country,
      state: item.state,
    }));

    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json([]);
  }
}
