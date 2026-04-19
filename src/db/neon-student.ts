/**
 * Окремий Postgres-клієнт для порталу учнів (students.itrobotics.com.ua).
 *
 * Використовує роль crm_student з обмеженими GRANT-ами —
 * див. scripts/setup-student-role-grants.js.
 *
 * КРИТИЧНО ВАЖЛИВО:
 *   - Ніколи не імпортувати цей файл з адмінських роутів (/api/..., /app/(app)/...)
 *   - Ніколи не імпортувати @/db з student-роутів (/api/student/..., /app/(student)/...)
 *   - Цей клієнт фізично не має доступу до users, sessions, payments тощо —
 *     Postgres відмовить на рівні БД, навіть якщо в коді буде помилка.
 *
 * Якщо DATABASE_URL_STUDENT не встановлена — експортуються заглушки, що кидають
 * помилку при виклику (щоб збірка проходила, але runtime був очевидно зламаний).
 */

import 'server-only';
import { neon, neonConfig } from '@neondatabase/serverless';

// Next.js 14 кешує fetch за замовчуванням — для свіжих даних з Neon цього не треба
neonConfig.fetchFunction = (url: any, init: any) => {
  return fetch(url, { ...init, cache: 'no-store' });
};

let sql: any;
if (process.env.DATABASE_URL_STUDENT) {
  sql = neon(process.env.DATABASE_URL_STUDENT);
} else {
  sql = async () => {
    throw new Error(
      'DATABASE_URL_STUDENT не встановлена. Student portal DB недоступна. ' +
        'Додайте змінну до .env.local та Vercel env vars.'
    );
  };
  // .query теж має викидати помилку
  sql.query = sql;
}

/**
 * Універсальний запит. Повертає масив рядків.
 * Використовує PostgreSQL-параметри $1, $2, ...
 */
export async function studentQuery(text: string, params?: unknown[]): Promise<any[]> {
  try {
    const result = params && params.length > 0 ? await sql.query(text, params) : await sql.query(text);
    return result as any[];
  } catch (error: any) {
    // Допомагаємо діагностувати permission denied (означає: GRANT-и неправильні
    // АБО запит намагається доступитися до забороненої таблиці — що добре!)
    if (error?.message?.includes('permission denied')) {
      console.error('[student-db] Permission denied — це OK якщо запит тестує ізоляцію;',
        'інакше перевірте GRANT-и (scripts/setup-student-role-grants.js)');
    }
    throw error;
  }
}

/** Отримати один рядок (або undefined) */
export async function studentGet<T = any>(text: string, params?: unknown[]): Promise<T | undefined> {
  const rows = await studentQuery(text, params);
  return rows[0] as T | undefined;
}

/** Отримати всі рядки */
export async function studentAll<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const rows = await studentQuery(text, params);
  return rows as T[];
}

/** Виконати запит без очікування структурованого результату (для INSERT/UPDATE/DELETE) */
export async function studentRun(text: string, params?: unknown[]): Promise<any[]> {
  return await studentQuery(text, params);
}

export default sql;
