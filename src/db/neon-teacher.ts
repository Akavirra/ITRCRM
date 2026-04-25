/**
 * Окремий Postgres-клієнт для teacher-порталу (teacher.itrobotics.com.ua).
 *
 * Використовує роль crm_teacher з обмеженими GRANT-ами —
 * див. scripts/setup-teacher-role-grants.js.
 *
 * КРИТИЧНО:
 *   - Ніколи не імпортувати цей файл з адмінських роутів (/api/..., /app/(app)/...)
 *   - Ніколи не імпортувати @/db з teacher-роутів (/api/teacher/..., /app/t/...)
 *   - Цей клієнт фізично не має доступу до payments/salary/system_settings —
 *     Postgres відмовить на рівні БД.
 *
 * Якщо DATABASE_URL_TEACHER не встановлена — експортуються заглушки, що кидають
 * помилку при виклику.
 */

import 'server-only';
import { neon, neonConfig } from '@neondatabase/serverless';

// Next.js 14 cache fetch by default — для свіжих даних треба no-store
neonConfig.fetchFunction = (url: any, init: any) => {
  return fetch(url, { ...init, cache: 'no-store' });
};

let sql: any;
if (process.env.DATABASE_URL_TEACHER) {
  sql = neon(process.env.DATABASE_URL_TEACHER);
} else {
  sql = async () => {
    throw new Error(
      'DATABASE_URL_TEACHER не встановлена. Teacher portal DB недоступна. ' +
        'Додайте змінну до .env.local та Vercel env vars.',
    );
  };
  sql.query = sql;
}

export async function teacherQuery(text: string, params?: unknown[]): Promise<any[]> {
  try {
    const result =
      params && params.length > 0 ? await sql.query(text, params) : await sql.query(text);
    return result as any[];
  } catch (error: any) {
    if (error?.message?.includes('permission denied')) {
      console.error(
        '[teacher-db] Permission denied — це OK якщо тестується ізоляція;',
        'інакше перевірте GRANT-и (scripts/setup-teacher-role-grants.js)',
      );
    }
    throw error;
  }
}

export async function teacherGet<T = any>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const rows = await teacherQuery(text, params);
  return rows[0] as T | undefined;
}

export async function teacherAll<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const rows = await teacherQuery(text, params);
  return rows as T[];
}

export async function teacherRun(text: string, params?: unknown[]): Promise<any[]> {
  return await teacherQuery(text, params);
}

export default sql;
