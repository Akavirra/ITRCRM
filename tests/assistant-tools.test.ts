jest.mock('@/db', () => ({
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  transaction: jest.fn((fn) => fn()),
}));

import { all, get } from '@/db';
import { createAssistantTools } from '@/lib/assistant/tools';

const mockAll = all as jest.MockedFunction<typeof all>;
const mockGet = get as jest.MockedFunction<typeof get>;

describe('assistant tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('query_debts uses Kyiv current month by default', async () => {
    jest.setSystemTime(new Date('2026-04-30T21:30:00.000Z'));
    mockAll.mockResolvedValue([] as never[]);

    const tools = createAssistantTools();
    await (tools.query_debts as any).execute({});

    expect(mockAll).toHaveBeenCalledWith(expect.stringContaining('FROM student_groups sg'), ['2026-05-01', '2026-05']);
  });

  test('query_active_students_count returns aggregate counts', async () => {
    mockGet.mockResolvedValue({
      total_students: '120',
      active_students: '90',
      inactive_students: '30',
    } as never);

    const tools = createAssistantTools();
    const result = await (tools.query_active_students_count as any).execute({});

    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('COUNT(*) FILTER (WHERE is_active = true)'));
    expect(result).toEqual({
      total_students: '120',
      active_students: '90',
      inactive_students: '30',
    });
  });

  test('query_attendance normalizes date filters before querying', async () => {
    mockGet.mockResolvedValue({
      present: '5',
      absent: '1',
      late: '0',
      excused: '0',
      total: '6',
    } as never);

    const tools = createAssistantTools(new Date('2026-04-12T08:00:00.000Z'));
    await (tools.query_attendance as any).execute({
      student_id: 7,
      date_from: '01.04.2026',
      date_to: '12.04.2026',
    });

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('FROM attendance a'),
      [7, '2026-04-01', '2026-04-12'],
    );
  });

  test('query_absences falls back to Kyiv month start and today', async () => {
    jest.setSystemTime(new Date('2026-04-30T21:30:00.000Z'));
    mockAll.mockResolvedValue([] as never[]);

    const tools = createAssistantTools();
    await (tools.query_absences as any).execute({});

    expect(mockAll).toHaveBeenCalledWith(
      expect.stringContaining('HAVING COUNT(*) FILTER (WHERE a.status = \'absent\') >= $3'),
      ['2026-05-01', '2026-05-01', 1],
    );
  });

  test('query_stats uses parameterized ranges for lessons and payments', async () => {
    jest.setSystemTime(new Date('2026-04-12T08:00:00.000Z'));
    mockGet
      .mockResolvedValueOnce({
        total_students: '100',
        active_students: '80',
        total_groups: '10',
        active_groups: '8',
        total_courses: '6',
        total_teachers: '5',
      } as never)
      .mockResolvedValueOnce({
        lessons_count: '12',
        done_count: '11',
      } as never)
      .mockResolvedValueOnce({
        total_payments: '25000',
      } as never);

    const tools = createAssistantTools();
    const result = await (tools.query_stats as any).execute({ period: 'today' });

    expect(mockGet).toHaveBeenNthCalledWith(2, expect.stringContaining('AND l.lesson_date = $1'), ['2026-04-12']);
    expect(mockGet).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('WHERE paid_at >= $1'),
      ['2026-04-12'],
    );
    expect(result).toEqual({
      total_students: '100',
      active_students: '80',
      total_groups: '10',
      active_groups: '8',
      total_courses: '6',
      total_teachers: '5',
      lessons_count: '12',
      done_count: '11',
      total_payments: '25000',
    });
  });

  test('query_today_lessons uses Kyiv today date', async () => {
    jest.setSystemTime(new Date('2026-04-30T21:30:00.000Z'));
    mockAll.mockResolvedValue([] as never[]);

    const tools = createAssistantTools();
    await (tools.query_today_lessons as any).execute({});

    expect(mockAll).toHaveBeenCalledWith(
      expect.stringContaining('WHERE l.lesson_date = $1'),
      ['2026-05-01'],
    );
  });

  test('query_daily_brief returns Kyiv-today aggregate', async () => {
    jest.setSystemTime(new Date('2026-04-30T21:30:00.000Z'));
    mockGet.mockResolvedValue({
      today: '2026-05-01',
      total_lessons: '8',
      scheduled_lessons: '5',
      done_lessons: '2',
      cancelled_lessons: '1',
      unique_groups: '6',
      unique_teachers: '4',
    } as never);

    const tools = createAssistantTools();
    const result = await (tools.query_daily_brief as any).execute({});

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('$1::date as today'),
      ['2026-05-01'],
    );
    expect(result).toEqual({
      today: '2026-05-01',
      total_lessons: '8',
      scheduled_lessons: '5',
      done_lessons: '2',
      cancelled_lessons: '1',
      unique_groups: '6',
      unique_teachers: '4',
    });
  });

  test('query_debts_summary uses normalized month', async () => {
    mockGet.mockResolvedValue({
      debtors_count: '14',
      total_debt: '18500',
      month: '2026-04',
    } as never);

    const tools = createAssistantTools();
    const result = await (tools.query_debts_summary as any).execute({ month: '04.2026' });

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(*) as debtors_count'),
      ['2026-04-01', '2026-04'],
    );
    expect(result).toEqual({
      debtors_count: '14',
      total_debt: '18500',
      month: '2026-04',
    });
  });

  test('query_at_risk_students combines normalized dates, month, and thresholds', async () => {
    mockAll.mockResolvedValue([] as never[]);

    const tools = createAssistantTools(new Date('2026-04-12T08:00:00.000Z'));
    await (tools.query_at_risk_students as any).execute({
      date_from: '01.04.2026',
      date_to: '12.04.2026',
      month: '04.2026',
      min_absences: 3,
      min_debt: 500,
      limit: 7,
    });

    expect(mockAll).toHaveBeenCalledWith(
      expect.stringContaining('OR GREATEST(g.monthly_price - COALESCE(p.paid_amount, 0), 0) >= $5'),
      ['2026-04-01', '2026-04-12', '2026-04-01', 3, 500, 7],
    );
  });

  test('query_lessons normalizes month-only input to month start', async () => {
    mockAll.mockResolvedValue([] as never[]);

    const tools = createAssistantTools();
    await (tools.query_lessons as any).execute({
      date_from: '04.2026',
      status: 'scheduled',
    });

    expect(mockAll).toHaveBeenCalledWith(
      expect.stringContaining('AND l.lesson_date >= $1'),
      ['2026-04-01', 'scheduled', 20],
    );
  });
});
