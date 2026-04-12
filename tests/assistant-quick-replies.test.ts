jest.mock('@/db', () => ({
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  transaction: jest.fn((fn) => fn()),
}));

import { all, get } from '@/db';
import {
  getAssistantQuickReply,
  matchAssistantQuickReply,
} from '@/lib/assistant/quick-replies';

const mockAll = all as jest.MockedFunction<typeof all>;
const mockGet = get as jest.MockedFunction<typeof get>;

describe('assistant quick replies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('matches active students prompt', () => {
    expect(matchAssistantQuickReply('Скільки активних учнів?')).toEqual({
      kind: 'active-students',
    });
  });

  test('matches monthly debtors prompt', () => {
    expect(matchAssistantQuickReply('Хто боржники цього місяця?')).toEqual({
      kind: 'monthly-debtors',
    });
  });

  test('returns formatted active students reply', async () => {
    mockGet.mockResolvedValue({
      total_students: '120',
      active_students: '90',
      inactive_students: '30',
    } as never);

    const reply = await getAssistantQuickReply({
      text: 'Скільки активних учнів?',
    });

    expect(reply).toContain('Активних учнів: 90.');
    expect(reply).toContain('Усього в базі: 120, неактивних: 30.');
  });

  test('returns formatted today lessons reply', async () => {
    jest.setSystemTime(new Date('2026-04-12T08:00:00.000Z'));
    mockAll.mockResolvedValue([
      {
        id: 1,
        group_title: 'Junior Robotics',
        teacher_name: 'Ірина',
        start_datetime: '2026-04-12T10:00:00.000Z',
        topic: 'Сенсори',
        status: 'scheduled',
      },
    ] as never);

    const reply = await getAssistantQuickReply({
      text: 'Які заняття сьогодні?',
      now: new Date('2026-04-12T08:00:00.000Z'),
    });

    expect(reply).toContain('На 12.04.2026 заплановано 1 занять.');
    expect(reply).toContain('Junior Robotics');
    expect(reply).toContain('Ірина');
    expect(reply).toContain('Сенсори');
  });

  test('returns formatted daily brief reply', async () => {
    mockGet.mockResolvedValue({
      today: '2026-04-12',
      total_lessons: '8',
      scheduled_lessons: '5',
      done_lessons: '2',
      cancelled_lessons: '1',
      unique_groups: '6',
      unique_teachers: '4',
    } as never);

    const reply = await getAssistantQuickReply({
      text: 'Дай короткий підсумок на сьогодні',
      now: new Date('2026-04-12T08:00:00.000Z'),
    });

    expect(reply).toContain('Підсумок на 12.04.2026: 8 занять.');
    expect(reply).toContain('Заплановано: 5, проведено: 2, скасовано: 1.');
  });

  test('returns formatted debtors reply', async () => {
    mockAll.mockResolvedValue([
      {
        student_name: 'Марко Тест',
        group_title: 'Python Teens',
        debt: '1500',
        paid_amount: '0',
        monthly_price: '1500',
      },
    ] as never);

    const reply = await getAssistantQuickReply({
      text: 'Хто боржники цього місяця?',
      now: new Date('2026-04-12T08:00:00.000Z'),
    });

    expect(reply).toContain('За 2026-04 боржників: 1.');
    expect(reply).toContain('Загальний борг: 1 500 грн.');
    expect(reply).toContain('Марко Тест');
  });

  test('returns formatted at-risk students reply', async () => {
    mockAll.mockResolvedValue([
      {
        student_name: 'Анна Тест',
        parent_name: 'Олена',
        parent_phone: '+380501112233',
        group_title: 'Scratch Kids',
        absent_count: '3',
        debt: '700',
      },
    ] as never);

    const reply = await getAssistantQuickReply({
      text: 'Покажи ризикових учнів за цей місяць',
      now: new Date('2026-04-12T08:00:00.000Z'),
    });

    expect(reply).toContain('Ризикових учнів за період 01.04.2026–12.04.2026: 1.');
    expect(reply).toContain('Анна Тест');
    expect(reply).toContain('3 пропуск(и)');
    expect(reply).toContain('борг 700 грн');
  });

  test('returns null for broader prompts', async () => {
    const reply = await getAssistantQuickReply({
      text: 'Покажи загальну статистику CRM',
    });

    expect(reply).toBeNull();
    expect(mockAll).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
