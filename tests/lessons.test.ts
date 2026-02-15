import { generateLessonsForGroup } from '../src/lib/lessons';

// Mock database
jest.mock('../src/db', () => ({
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  transaction: jest.fn((fn) => fn()),
}));

import { get, all, run } from '../src/db';

const mockGet = get as jest.MockedFunction<typeof get>;
const mockAll = all as jest.MockedFunction<typeof all>;
const mockRun = run as jest.MockedFunction<typeof run>;

describe('Lesson Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate lessons for a group', () => {
    // Mock group data
    mockGet.mockReturnValue({
      id: 1,
      weekly_day: 5, // Friday
      start_time: '11:30',
      duration_minutes: 90,
      timezone: 'Europe/Uzhgorod',
      start_date: '2024-01-12',
      end_date: null,
    });

    // Mock existing lessons (empty)
    mockAll.mockReturnValue([]);

    // Mock insert
    mockRun.mockReturnValue({ lastInsertRowid: 1 });

    const result = generateLessonsForGroup(1, 8, 1);

    expect(result.generated).toBeGreaterThan(0);
    expect(result.skipped).toBe(0);
  });

  test('should skip existing lessons', () => {
    // Mock group data
    mockGet.mockReturnValue({
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
    mockAll.mockReturnValue(existingDates);

    const result = generateLessonsForGroup(1, 8, 1);

    expect(result.skipped).toBeGreaterThan(0);
  });

  test('should throw error for non-existent group', () => {
    mockGet.mockReturnValue(null);

    expect(() => generateLessonsForGroup(999, 8, 1)).toThrow('Group not found');
  });
});