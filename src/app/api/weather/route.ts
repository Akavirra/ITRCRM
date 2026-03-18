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
  code: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENWEATHERMAP_API_KEY не налаштований' }, { status: 503 });
  }

  const row = await get<{ weather_city: string }>(
    `SELECT weather_city FROM user_settings WHERE user_id = $1`,
    [user.id]
  );
  const city = row?.weather_city || 'Kyiv';

  const cached = cache.get(city);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  // Step 1: Geocode city → get lat/lon + Ukrainian name
  // This works with any language input (Ukrainian, English, etc.)
  let lat: number, lon: number, cityNameUk: string;
  try {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
    const geoRes = await fetch(geoUrl, { next: { revalidate: 0 } });
    if (!geoRes.ok) throw new Error('geocode failed');
    const geoJson = await geoRes.json();
    if (!geoJson?.[0]) {
      return NextResponse.json({ error: 'Місто не знайдено' }, { status: 404 });
    }
    lat = geoJson[0].lat;
    lon = geoJson[0].lon;
    cityNameUk = geoJson[0].local_names?.uk || geoJson[0].name;
  } catch {
    return NextResponse.json({ error: 'Не вдалося знайти місто' }, { status: 502 });
  }

  // Step 2: Fetch weather by coordinates (reliable for any city)
  let owmRes: Response;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=uk`;
    owmRes = await fetch(url, { next: { revalidate: 0 } });
  } catch {
    return NextResponse.json({ error: 'Не вдалося отримати погоду' }, { status: 502 });
  }

  if (!owmRes.ok) {
    return NextResponse.json({ error: 'Помилка отримання погоди' }, { status: 502 });
  }

  const json = await owmRes.json();

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
