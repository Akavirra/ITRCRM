type EnvMap = Record<string, string | undefined>;

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'JWT_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
] as const;

const REQUIRED_ONE_OF = [
  ['NEXT_PUBLIC_APP_URL', 'NEXTAUTH_URL'],
] as const;

let hasValidatedRuntimeEnv = false;

function isMissing(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function getMissingRuntimeEnv(
  env: EnvMap,
  options: { isProduction: boolean }
): string[] {
  if (!options.isProduction) {
    return [];
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => isMissing(env[key])).map(String);

  for (const group of REQUIRED_ONE_OF) {
    const hasAnyValue = group.some((key) => !isMissing(env[key]));
    if (!hasAnyValue) {
      missing.push(group.join(' or '));
    }
  }

  return missing;
}

export function validateRuntimeEnv(): void {
  if (hasValidatedRuntimeEnv || process.env.NODE_ENV === 'test') {
    return;
  }

  hasValidatedRuntimeEnv = true;

  const missing = getMissingRuntimeEnv(process.env, {
    isProduction: process.env.NODE_ENV === 'production',
  });

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `[env] Missing required runtime environment variables: ${missing.join(', ')}`
  );
}
