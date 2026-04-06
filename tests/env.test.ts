import { getMissingRuntimeEnv } from '@/lib/env';

describe('runtime env validation', () => {
  test('does not require production env in development mode', () => {
    const missing = getMissingRuntimeEnv({}, { isProduction: false });

    expect(missing).toEqual([]);
  });

  test('requires core production env values', () => {
    const missing = getMissingRuntimeEnv({}, { isProduction: true });

    expect(missing).toContain('DATABASE_URL');
    expect(missing).toContain('JWT_SECRET');
    expect(missing).toContain('TELEGRAM_BOT_TOKEN');
    expect(missing).toContain('TELEGRAM_WEBHOOK_SECRET');
    expect(missing).toContain('NEXT_PUBLIC_APP_URL or NEXTAUTH_URL');
  });

  test('accepts either NEXT_PUBLIC_APP_URL or NEXTAUTH_URL', () => {
    const missing = getMissingRuntimeEnv(
      {
        DATABASE_URL: 'postgres://example',
        JWT_SECRET: 'secret',
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
        NEXTAUTH_URL: 'https://example.com',
      },
      { isProduction: true }
    );

    expect(missing).toEqual([]);
  });
});
