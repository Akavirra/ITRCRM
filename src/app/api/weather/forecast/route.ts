import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get } from '@/db';

export const dynamic = 'force-dynamic';

export interface ForecastDay {
  date: string;
  weekday: string;
  temp_min: number;
  temp_max: number;
  description: string;
  code: number;
}

interface ForecastResult {
  city: string;
  days: ForecastDay[];
}

const DAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const cache = new Map<string, { data: ForecastResult; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 503 });

  const row = await get<{ weather_city: string }>(
    `SELECT weather_city FROM user_settings WHERE user_id = $1`,
    [user.id]
  );
  const city = row?.weather_city || 'Kyiv';

  const cached = cache.get(city);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  // Geocode
  let lat: number, lon: number, cityNameUk: string;
  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`,
      { next: { revalidate: 0 } }
    );
    const geoJson = await geoRes.json();
    if (!geoJson?.[0]) return NextResponse.json({ error: 'Місто не знайдено' }, { status: 404 });
    lat = geoJson[0].lat;
    lon = geoJson[0].lon;
    cityNameUk = geoJson[0].local_names?.uk || geoJson[0].name;
  } catch {
    return NextResponse.json({ error: 'Geocode error' }, { status: 502 });
  }

  // Fetch 5-day / 3-hour forecast
  let forecastRes: Response;
  try {
    forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=uk`,
      { next: { revalidate: 0 } }
    );
  } catch {
    return NextResponse.json({ error: 'Fetch error' }, { status: 502 });
  }

  if (!forecastRes.ok) return NextResponse.json({ error: 'API error' }, { status: 502 });

  const json = await forecastRes.json();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' }); // YYYY-MM-DD

  // Group 3-hour intervals by local Kyiv date
  const byDate = new Map<string, { temps: number[]; codes: number[]; desc: string }>();
  for (const item of json.list) {
    const dateStr = new Date(item.dt * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
    if (!byDate.has(dateStr)) byDate.set(dateStr, { temps: [], codes: [], desc: '' });
    const entry = byDate.get(dateStr)!;
    entry.temps.push(item.main.temp);
    entry.codes.push(item.weather[0].id);
    // prefer midday description
    const localHour = new Date(item.dt * 1000).toLocaleString('en-GB', { timeZone: 'Europe/Kyiv', hour: 'numeric', hour12: false });
    if (Number(localHour) >= 11 && Number(localHour) <= 14) {
      entry.desc = item.weather[0].description;
    } else if (!entry.desc) {
      entry.desc = item.weather[0].description;
    }
  }

  const days: ForecastDay[] = [];
  for (const [date, entry] of Array.from(byDate)) {
    if (date < today) continue;
    // day of week from date string (YYYY-MM-DD at noon UTC = safe for any timezone)
    const dow = new Date(date + 'T12:00:00Z').getUTCDay();
    days.push({
      date,
      weekday: date === today ? 'Сьогодні' : DAYS_SHORT[dow],
      temp_min: Math.round(Math.min(...entry.temps)),
      temp_max: Math.round(Math.max(...entry.temps)),
      description: entry.desc,
      code: entry.codes[Math.floor(entry.codes.length / 2)],
    });
    if (days.length >= 6) break;
  }

  const result: ForecastResult = { city: cityNameUk, days };
  cache.set(city, { data: result, ts: Date.now() });
  return NextResponse.json(result);
}
