export interface UkrainianHoliday {
  date: string;
  name: string;
  category: 'state' | 'religious';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getOrthodoxEasterDate(year: number): Date {
  // Meeus Julian algorithm, then shifted to Gregorian calendar.
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;

  const julianDate = new Date(Date.UTC(year, month - 1, day));
  return addUtcDays(julianDate, 13);
}

export function getUkrainianHolidaysForYear(year: number): UkrainianHoliday[] {
  const easter = getOrthodoxEasterDate(year);
  const trinity = addUtcDays(easter, 49);

  return [
    { date: `${year}-01-01`, name: 'Новий рік', category: 'state' },
    { date: `${year}-03-08`, name: 'Міжнародний жіночий день', category: 'state' },
    { date: formatDateKey(easter), name: 'Великдень', category: 'religious' },
    { date: `${year}-05-01`, name: 'День праці', category: 'state' },
    { date: `${year}-05-08`, name: "День пам'яті та перемоги над нацизмом у Другій світовій війні 1939-1945 років", category: 'state' },
    { date: formatDateKey(trinity), name: 'Трійця', category: 'religious' },
    { date: `${year}-06-28`, name: 'День Конституції України', category: 'state' },
    { date: `${year}-07-15`, name: 'День Української Державності', category: 'state' },
    { date: `${year}-08-24`, name: 'День Незалежності України', category: 'state' },
    { date: `${year}-10-01`, name: 'День захисників і захисниць України', category: 'state' },
    { date: `${year}-12-25`, name: 'Різдво Христове', category: 'religious' },
  ];
}

export function getUkrainianHolidaysInRange(startDate: Date, endDate: Date): UkrainianHoliday[] {
  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const holidays = [
    ...getUkrainianHolidaysForYear(startYear),
    ...(endYear !== startYear ? getUkrainianHolidaysForYear(endYear) : []),
  ];

  const startKey = formatDateKey(startDate);
  const endKey = formatDateKey(endDate);

  return holidays
    .filter((holiday) => holiday.date >= startKey && holiday.date <= endKey)
    .sort((a, b) => a.date.localeCompare(b.date));
}
