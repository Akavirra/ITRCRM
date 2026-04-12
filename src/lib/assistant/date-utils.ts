import { formatInTimeZone } from 'date-fns-tz';

import { ASSISTANT_TIMEZONE } from './constants';

export type AssistantStatsPeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export function normalizeDate(value: unknown): string | undefined {
  if (!value || typeof value !== 'string') return undefined;

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dayMonthYear = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dayMonthYear) {
    const [, day, month, year] = dayMonthYear;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;

  const monthYear = trimmed.match(/^(\d{1,2})[./](\d{4})$/);
  if (monthYear) {
    const [, month, year] = monthYear;
    return `${year}-${month.padStart(2, '0')}-01`;
  }

  return undefined;
}

export function normalizeMonth(value: unknown): string | undefined {
  if (!value || typeof value !== 'string') return undefined;

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;

  const monthYear = trimmed.match(/^(\d{1,2})[./](\d{4})$/);
  if (monthYear) {
    const [, month, year] = monthYear;
    return `${year}-${month.padStart(2, '0')}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.slice(0, 7);

  return undefined;
}

export function getAssistantToday(date = new Date()): string {
  return formatInTimeZone(date, ASSISTANT_TIMEZONE, 'yyyy-MM-dd');
}

export function getAssistantCurrentMonth(date = new Date()): string {
  return formatInTimeZone(date, ASSISTANT_TIMEZONE, 'yyyy-MM');
}

export function getAssistantMonthStart(date = new Date()): string {
  return `${getAssistantCurrentMonth(date)}-01`;
}

export function getStatsDateFilter(period: AssistantStatsPeriod, now = new Date()): {
  clause: string;
  params: string[];
} {
  switch (period) {
    case 'today':
      return { clause: 'AND l.lesson_date = $1', params: [getAssistantToday(now)] };
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { clause: 'AND l.lesson_date >= $1', params: [getAssistantToday(weekAgo)] };
    }
    case 'month':
      return { clause: 'AND l.lesson_date >= $1', params: [getAssistantMonthStart(now)] };
    case 'year':
      return {
        clause: 'AND l.lesson_date >= $1',
        params: [formatInTimeZone(now, ASSISTANT_TIMEZONE, 'yyyy-01-01')],
      };
    case 'all':
    default:
      return { clause: '', params: [] };
  }
}

export function getPaymentsRangeStart(period: AssistantStatsPeriod, now = new Date()): string {
  if (period === 'all') return '2000-01-01';
  if (period === 'year') return formatInTimeZone(now, ASSISTANT_TIMEZONE, 'yyyy-01-01');
  if (period === 'today') return getAssistantToday(now);
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getAssistantToday(weekAgo);
  }

  return getAssistantMonthStart(now);
}
