const assistantKeyCooldowns = new Map<string, number>();

export const ASSISTANT_KEY_COOLDOWN_MS = 30 * 60 * 1000;

function splitKeys(rawValue?: string) {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(/[\r\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseAssistantApiKeys(
  rawKeys?: string,
  fallbackKey?: string,
): string[] {
  const seen = new Set<string>();
  const keys = [...splitKeys(rawKeys), ...splitKeys(fallbackKey)];

  return keys.filter((key) => {
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getAssistantApiKeysFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return parseAssistantApiKeys(env.GROQ_API_KEYS, env.GROQ_API_KEY);
}

export function isAssistantQuotaError(error: unknown): boolean {
  const candidate = error as {
    statusCode?: number;
    status?: number;
    response?: { status?: number };
    cause?: unknown;
    message?: string;
  };

  const statusCode =
    candidate?.statusCode ?? candidate?.status ?? candidate?.response?.status;
  if (statusCode === 429) {
    return true;
  }

  const message = String(candidate?.message || '').toLowerCase();
  if (
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('too many requests') ||
    message.includes('resource exhausted') ||
    message.includes('credits') ||
    message.includes('limit exceeded')
  ) {
    return true;
  }

  if (candidate?.cause) {
    return isAssistantQuotaError(candidate.cause);
  }

  return false;
}

export function markAssistantKeyRateLimited(
  apiKey: string,
  now = Date.now(),
  cooldownMs = ASSISTANT_KEY_COOLDOWN_MS,
) {
  assistantKeyCooldowns.set(apiKey, now + cooldownMs);
}

export function clearExpiredAssistantKeyCooldowns(now = Date.now()) {
  assistantKeyCooldowns.forEach((expiresAt, apiKey) => {
    if (expiresAt <= now) {
      assistantKeyCooldowns.delete(apiKey);
    }
  });
}

export function getAvailableAssistantApiKeys(
  keys: string[],
  now = Date.now(),
): string[] {
  clearExpiredAssistantKeyCooldowns(now);

  return keys.filter((key) => {
    const cooldownUntil = assistantKeyCooldowns.get(key);
    return !cooldownUntil || cooldownUntil <= now;
  });
}

export function resetAssistantKeyCooldowns() {
  assistantKeyCooldowns.clear();
}
