import {
  ASSISTANT_KEY_COOLDOWN_MS,
  getAssistantApiKeysFromEnv,
  getAvailableAssistantApiKeys,
  isAssistantQuotaError,
  markAssistantKeyRateLimited,
  parseAssistantApiKeys,
  resetAssistantKeyCooldowns,
} from '@/lib/assistant/provider-failover';

describe('assistant provider failover', () => {
  beforeEach(() => {
    resetAssistantKeyCooldowns();
  });

  test('parses comma and newline separated keys with fallback key', () => {
    expect(parseAssistantApiKeys('key-1,\nkey-2,key-1', 'key-3')).toEqual([
      'key-1',
      'key-2',
      'key-3',
    ]);
  });

  test('reads keys from env with fallback to GROQ_API_KEY', () => {
    expect(
      getAssistantApiKeysFromEnv({
        GROQ_API_KEYS: 'pool-1,pool-2',
        GROQ_API_KEY: 'single-key',
      }),
    ).toEqual(['pool-1', 'pool-2', 'single-key']);
  });

  test('detects quota errors by status code', () => {
    expect(isAssistantQuotaError({ statusCode: 429 })).toBe(true);
    expect(isAssistantQuotaError({ response: { status: 429 } })).toBe(true);
  });

  test('detects quota errors by message', () => {
    expect(isAssistantQuotaError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isAssistantQuotaError(new Error('Quota exceeded for this key'))).toBe(
      true,
    );
  });

  test('does not treat generic server errors as quota errors', () => {
    expect(
      isAssistantQuotaError({ statusCode: 500, message: 'Internal error' }),
    ).toBe(false);
  });

  test('skips rate-limited keys during cooldown window', () => {
    markAssistantKeyRateLimited('key-2', 1_000, 10_000);

    expect(
      getAvailableAssistantApiKeys(['key-1', 'key-2', 'key-3'], 5_000),
    ).toEqual(['key-1', 'key-3']);
  });

  test('re-enables key after cooldown expires', () => {
    markAssistantKeyRateLimited(
      'key-2',
      1_000,
      ASSISTANT_KEY_COOLDOWN_MS,
    );

    expect(
      getAvailableAssistantApiKeys(
        ['key-1', 'key-2', 'key-3'],
        1_000 + ASSISTANT_KEY_COOLDOWN_MS,
      ),
    ).toEqual(['key-1', 'key-2', 'key-3']);
  });
});
