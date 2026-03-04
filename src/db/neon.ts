import { neon, neonConfig } from '@neondatabase/serverless';

// ВАЖЛИВО: Next.js 14 розширює глобальний fetch() і кешує відповіді за замовчуванням.
// Neon driver використовує fetch() для HTTP запитів до Neon API.
// Без cache: 'no-store' SQL запити кешуються і GET повертає застарілі дані.
neonConfig.fetchFunction = (url: any, init: any) => {
  return fetch(url, { ...init, cache: 'no-store' });
};

// Не викидаємо помилку, якщо DATABASE_URL не встановлена (для збірки)
let sql: any;
if (process.env.DATABASE_URL) {
  sql = neon(process.env.DATABASE_URL);
} else {
  // Функція-заглушка для збірки
  sql = async () => [];
}

// Універсальна функція для запитів
export async function query(text: string, params?: unknown[]) {
  try {
    let result;
    if (params && params.length > 0) {
      result = await sql.query(text, params);
    } else {
      result = await sql.query(text);
    }
    // DEBUG: логування для діагностики на Vercel (тимчасово)
    console.log('[DB Query]', text.substring(0, 100), '| params:', JSON.stringify(params || []).substring(0, 100), '| result type:', typeof result, '| isArray:', Array.isArray(result), '| length:', Array.isArray(result) ? result.length : 'N/A');
    if (Array.isArray(result) && result.length > 0) {
      console.log('[DB Query] first row sample:', JSON.stringify(result[0]).substring(0, 200));
    }
    return result;
  } catch (error) {
    console.error('DB Query Error:', { text: text.substring(0, 200), params, error });
    throw error;
  }
}

// Функція для отримання одного рядка
export async function queryOne(text: string, params?: unknown[]) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

// Адаптер для сумісності з існуючим кодом (run, get, all, transaction)
export async function run(sql: string, params: unknown[] = []): Promise<any[]> {
  const result = await query(sql, params);
  return result as any[];
}

export async function get<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const row = await queryOne(sql, params);
  return row as T | undefined;
}

export async function all<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const rows = await query(sql, params);
  return rows as T[];
}

// Транзакції - Neon підтримує через функцію transaction
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  // Neon serverless не має нативної підтримки транзакцій у синхронному режимі
  // Для транзакцій потрібно використовувати pooling режим або neonPool
  // Тут повертаємо результат виконання функції
  return await fn();
}

// Логування помилок
export async function logError(
  errorMessage: string,
  errorStack?: string,
  userId?: number,
  requestPath?: string,
  requestMethod?: string
) {
  try {
    await run(
      `INSERT INTO error_logs (error_message, error_stack, user_id, request_path, request_method)
       VALUES ($1, $2, $3, $4, $5)`,
      [errorMessage, errorStack || null, userId || null, requestPath || null, requestMethod || null]
    );
  } catch (e) {
    console.error('Failed to log error to database:', e);
  }
}

export default sql;
