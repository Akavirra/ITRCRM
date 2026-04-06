jest.mock('@/db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  transaction: jest.fn((fn) => fn()),
}));

import { all, get, run } from '@/db';
import { generateLessonsForGroup } from '@/lib/lessons';

const mockGet = get as jest.MockedFunction<typeof get>;
const mockAll = all as jest.MockedFunction<typeof all>;
const mockRun = run as jest.MockedFunction<typeof run>;

describe('Lesson Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-10T09:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should generate lessons for a group', async () => {
    // Mock group data
    mockGet.mockResolvedValue({
      id: 1,
      weekly_day: 5, // Friday
      start_time: '11:30',
      duration_minutes: 90,
      timezone: 'Europe/Uzhgorod',
      start_date: '2024-01-12',
      end_date: null,
    });

    // Mock existing lessons (empty)
    mockAll.mockResolvedValue([]);

    // Mock insert
    mockRun.mockResolvedValue([{ id: 1 }] as any);

    const result = await generateLessonsForGroup(1, 8, 1);

    expect(result.generated).toBeGreaterThan(0);
    expect(result.skipped).toBe(0);
    expect(mockRun).toHaveBeenCalled();
  });

  test('should skip existing lessons', async () => {
    // Mock group data
    mockGet.mockResolvedValue({
      id: 1,
      weekly_day: 5,
      start_time: '11:30',
      duration_minutes: 90,
      timezone: 'Europe/Uzhgorod',
      start_date: '2024-01-12',
      end_date: null,
    });

    // Mock existing lessons
    const existingDates = [
      { lesson_date: '2024-01-12' },
      { lesson_date: '2024-01-19' },
    ];
    mockAll.mockResolvedValue(existingDates as any);

    const result = await generateLessonsForGroup(1, 8, 1);

    expect(result.skipped).toBeGreaterThan(0);
  });

  test('should throw error for non-existent group', async () => {
    mockGet.mockResolvedValue(undefined);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(generateLessonsForGroup(999, 8, 1)).rejects.toThrow('Group not found');
    consoleErrorSpy.mockRestore();
  });
});
