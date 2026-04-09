import { NextRequest, NextResponse } from 'next/server';
import { all } from '@/db';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { getUkrainianHolidaysInRange } from '@/lib/ukrainian-holidays';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const dynamic = 'force-dynamic';

const KYIV_TIME_ZONE = 'Europe/Kyiv';

interface StudentBirthdayRow {
  id: number;
  full_name: string;
  birth_date: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getBirthdayDateForYear(birthDate: string, year: number): Date {
  const [, monthRaw, dayRaw] = birthDate.slice(0, 10).split('-').map(Number);
  const month = monthRaw;
  const day = month === 2 && dayRaw === 29 && !isLeapYear(year) ? 28 : dayRaw;
  return new Date(Date.UTC(year, month - 1, day));
}

function getNextBirthdayDate(birthDate: string, today: Date): Date {
  const year = today.getUTCFullYear();
  const currentYearBirthday = getBirthdayDateForYear(birthDate, year);
  if (currentYearBirthday >= today) {
    return currentYearBirthday;
  }
  return getBirthdayDateForYear(birthDate, year + 1);
}

function getAgeOnBirthday(birthDate: string, birthdayDate: Date): number {
  const birthYear = Number(birthDate.slice(0, 4));
  return birthdayDate.getUTCFullYear() - birthYear;
}

function ageWord(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;

  if (mod100 >= 11 && mod100 <= 19) return 'років';
  if (mod10 === 1) return 'рік';
  if (mod10 >= 2 && mod10 <= 4) return 'роки';
  return 'років';
}

function formatDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function formatBirthdayLabel(date: Date, dayDiff: number): string {
  if (dayDiff === 0) return 'Сьогодні';
  if (dayDiff === 1) return 'Завтра';

  return new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const kyivNow = toZonedTime(new Date(), KYIV_TIME_ZONE);
  const today = new Date(Date.UTC(kyivNow.getFullYear(), kyivNow.getMonth(), kyivNow.getDate()));
  const endDate = addDays(today, 7);
  const todayKey = formatDateKey(today);

  const students = await all<StudentBirthdayRow>(
    `SELECT id, full_name, birth_date
     FROM students
     WHERE is_active = TRUE
       AND birth_date IS NOT NULL`
  );

  const birthdays = students
    .map((student) => {
      const nextBirthday = getNextBirthdayDate(student.birth_date, today);
      const dayDiff = differenceInCalendarDays(nextBirthday, today);

      return {
        id: student.id,
        full_name: student.full_name,
        birth_date: student.birth_date,
        next_birthday: format(nextBirthday, 'yyyy-MM-dd'),
        dayDiff,
        age: getAgeOnBirthday(student.birth_date, nextBirthday),
        label: formatBirthdayLabel(nextBirthday, dayDiff),
      };
    })
    .filter((student) => student.dayDiff >= 0 && student.dayDiff <= 7)
    .sort((a, b) => {
      if (a.dayDiff !== b.dayDiff) return a.dayDiff - b.dayDiff;
      return a.full_name.localeCompare(b.full_name, 'uk-UA');
    });

  const holidays = getUkrainianHolidaysInRange(today, endDate).map((holiday) => ({
    ...holiday,
    dayDiff: differenceInCalendarDays(new Date(`${holiday.date}T00:00:00.000Z`), today),
    label: holiday.date === todayKey
      ? 'Сьогодні'
      : formatBirthdayLabel(new Date(`${holiday.date}T00:00:00.000Z`), differenceInCalendarDays(new Date(`${holiday.date}T00:00:00.000Z`), today)),
  }));

  return NextResponse.json({
    today: todayKey,
    holidaysToday: holidays.filter((holiday) => holiday.dayDiff === 0),
    upcomingHolidays: holidays.filter((holiday) => holiday.dayDiff > 0),
    birthdaysToday: birthdays
      .filter((student) => student.dayDiff === 0)
      .map((student) => ({
        ...student,
        ageLabel: `${student.age} ${ageWord(student.age)}`,
      })),
    upcomingBirthdays: birthdays
      .filter((student) => student.dayDiff > 0)
      .map((student) => ({
        ...student,
        ageLabel: `${student.age} ${ageWord(student.age)}`,
      })),
  });
}
