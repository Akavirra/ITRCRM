import {
  getAssistantCurrentMonth,
  getAssistantMonthStart,
  getAssistantToday,
  getPaymentsRangeStart,
  getStatsDateFilter,
  normalizeDate,
  normalizeMonth,
} from '@/lib/assistant/date-utils';

describe('assistant date utils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('normalizeDate supports multiple input formats', () => {
    expect(normalizeDate('2026-04-12')).toBe('2026-04-12');
    expect(normalizeDate('12.04.2026')).toBe('2026-04-12');
    expect(normalizeDate('12/4/2026')).toBe('2026-04-12');
    expect(normalizeDate('2026-04')).toBe('2026-04-01');
    expect(normalizeDate('4.2026')).toBe('2026-04-01');
    expect(normalizeDate('bad-date')).toBeUndefined();
  });

  test('normalizeMonth supports month and full date inputs', () => {
    expect(normalizeMonth('2026-04')).toBe('2026-04');
    expect(normalizeMonth('04.2026')).toBe('2026-04');
    expect(normalizeMonth('2026-04-12')).toBe('2026-04');
    expect(normalizeMonth('bad-month')).toBeUndefined();
  });

  test('assistant date helpers use Europe/Kyiv instead of raw UTC boundaries', () => {
    const instant = new Date('2026-04-30T21:30:00.000Z');

    expect(getAssistantToday(instant)).toBe('2026-05-01');
    expect(getAssistantCurrentMonth(instant)).toBe('2026-05');
    expect(getAssistantMonthStart(instant)).toBe('2026-05-01');
  });

  test('stats and payment ranges respect selected period', () => {
    const instant = new Date('2026-04-12T08:00:00.000Z');

    expect(getStatsDateFilter('today', instant)).toEqual({
      clause: 'AND l.lesson_date = $1',
      params: ['2026-04-12'],
    });

    expect(getStatsDateFilter('all', instant)).toEqual({
      clause: '',
      params: [],
    });

    expect(getPaymentsRangeStart('all', instant)).toBe('2000-01-01');
    expect(getPaymentsRangeStart('month', instant)).toBe('2026-04-01');
    expect(getPaymentsRangeStart('today', instant)).toBe('2026-04-12');
  });
});
