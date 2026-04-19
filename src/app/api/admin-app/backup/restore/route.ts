import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';
import { query, run } from '@/db/neon';
import { fetchDriveFileContent } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return unauthorized();

  try {
    const { fileId } = await request.json();
    if (!fileId) return badRequest('ID файлу не вказано');

    // 1. Отримуємо вміст файлу з Drive
    const response = await fetchDriveFileContent(fileId);
    if (!response.ok) throw new Error('Не вдалося завантажити файл з Google Drive');
    
    const data = await response.json();
    const tables = Object.keys(data);

    // 2. Відновлення даних (транзакційно було б краще, але Neon має обмеження)
    // Тому йдемо по таблицях
    for (const table of tables) {
      const rows = data[table];
      if (!Array.isArray(rows)) continue;

      // Очищаємо таблицю перед відновленням (ОБЕРЕЖНО!)
      // В реальному проекті краще робити софт-деліт або бекап перед відновленням
      await run(`DELETE FROM ${table}`);

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const colNames = columns.join(', ');

        await run(
          `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`,
          values
        );
      }
    }

    return NextResponse.json({ success: true, restoredTables: tables });

  } catch (error: any) {
    console.error('Restore API Error:', error);
    return NextResponse.json({ error: error.message || 'Помилка при відновленні даних' }, { status: 500 });
  }
}
