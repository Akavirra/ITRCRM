import { getAssistantGuardrailReply } from '@/lib/assistant/guardrails';

describe('assistant guardrails', () => {
  test('returns off-topic reply for weather question', () => {
    const reply = getAssistantGuardrailReply('Яка сьогодні погода?');

    expect(reply).toContain('Я працюю тільки з даними цієї CRM-системи');
    expect(reply).toContain('погоди');
  });

  test('returns off-topic reply for news question', () => {
    const reply = getAssistantGuardrailReply('Які сьогодні новини?');

    expect(reply).toContain('новин');
  });

  test('does not block crm question', () => {
    const reply = getAssistantGuardrailReply('Які заняття сьогодні?');

    expect(reply).toBeNull();
  });

  test('does not block student question', () => {
    const reply = getAssistantGuardrailReply('Покажи учнів з пропусками');

    expect(reply).toBeNull();
  });
});
