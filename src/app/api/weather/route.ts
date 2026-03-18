import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

interface CacheEntry {
  data: WeatherResult;
  ts: number;
}

interface WeatherResult {
  city: string;
  temp: number;
  feels_like: number;
  description: string;
  humidity: number;
  wind: number;
  code: number; // OWM condition code
}

// Server-side in-memory cache: city → {data, timestamp}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENWEATHERMAP_API_KEY не налаштований' }, { status: 503 });
  }

  // Get user's preferred city from user_settings
  const row = await get<{ weather_city: string }>(
    `SELECT weather_city FROM user_settings WHERE user_id = $1`,
    [user.id]
  );
  const city = row?.weather_city || 'Kyiv';

  // Check cache
  const cached = cache.get(city);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  // Fetch from OpenWeatherMap
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=uk`;
  let owmRes: Response;
  try {
    owmRes = await fetch(url, { next: { revalidate: 0 } });
  } catch {
    return NextResponse.json({ error: 'Не вдалося отримати погоду' }, { status: 502 });
  }

  if (!owmRes.ok) {
    const err = await owmRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.message || 'Місто не знайдено' },
      { status: owmRes.status === 404 ? 404 : 502 }
    );
  }

  const json = await owmRes.json();

  // Try to get Ukrainian city name via Geocoding API
  let cityNameUk = json.name;
  try {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
    const geoRes = await fetch(geoUrl, { next: { revalidate: 0 } });
    if (geoRes.ok) {
      const geoJson = await geoRes.json();
      if (geoJson?.[0]?.local_names?.uk) {
        cityNameUk = geoJson[0].local_names.uk;
      }
    }
  } catch {
    // keep default json.name
  }

  const result: WeatherResult = {
    city: cityNameUk,
    temp: Math.round(json.main.temp),
    feels_like: Math.round(json.main.feels_like),
    description: json.weather?.[0]?.description ?? '',
    humidity: json.main.humidity,
    wind: Math.round(json.wind?.speed ?? 0),
    code: json.weather?.[0]?.id ?? 800,
  };

  cache.set(city, { data: result, ts: Date.now() });
  return NextResponse.json(result);
}
