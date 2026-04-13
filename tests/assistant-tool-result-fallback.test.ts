import { formatAssistantToolResults } from '@/lib/assistant/tool-result-fallback';

describe('assistant tool result fallback', () => {
  test('formats absences tool results', () => {
    const reply = formatAssistantToolResults([
      {
        toolName: 'query_absences',
        output: [
          {
            student_name: 'Марко Тест',
            group_title: 'Python Teens',
            absent_count: '3',
            total_lessons: '8',
          },
        ],
      },
    ]);

    expect(reply).toContain('пропуски є у 1 учнів');
    expect(reply).toContain('Марко Тест');
    expect(reply).toContain('3 пропуск(и) із 8 занять');
  });

  test('formats attendance tool results', () => {
    const reply = formatAssistantToolResults([
      {
        toolName: 'query_attendance',
        output: {
          present: '5',
          absent: '1',
          late: '0',
          excused: '0',
          total: '6',
        },
      },
    ]);

    expect(reply).toContain('Присутні: 5, відсутні: 1');
    expect(reply).toContain('Усього відміток: 6');
  });

  test('formats debts tool results', () => {
    const reply = formatAssistantToolResults([
      {
        toolName: 'query_debts',
        output: [
          {
            student_name: 'Анна Тест',
            group_title: 'Scratch Kids',
            debt: '1200',
          },
        ],
      },
    ]);

    expect(reply).toContain('Знайдено 1 боржників');
    expect(reply).toContain('1 200 грн');
  });

  test('returns null for unsupported tool results', () => {
    const reply = formatAssistantToolResults([
      {
        toolName: 'query_teachers',
        output: [],
      },
    ]);

    expect(reply).toBeNull();
  });
});
