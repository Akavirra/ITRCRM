import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/neon';
import { uploadFileToDrive, getOrCreateFolder } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

const BACKUP_ROOT_FOLDER_NAME = 'CRM_Backups';
const CATEGORIES_TABLES: Record<string, string[]> = {
  students: ['students', 'student_groups', 'individual_balances'],
  payments: ['payments', 'individual_payments', 'pricing'],
  attendance: ['attendance'],
  groups: ['groups', 'group_teacher_assignments'],
  courses: ['courses'],
  system: ['users', 'system_settings', 'user_settings']
};

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const { categories } = await request.json();
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return badRequest('Категорії для бекапу не вибрані');
    }

    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
      return NextResponse.json({ error: 'GOOGLE_DRIVE_ROOT_FOLDER_ID не налаштовано' }, { status: 500 });
    }

    // 1. Отримуємо або створюємо кореневу папку бекапів
    const crmBackupsFolder = await getOrCreateFolder(rootFolderId, BACKUP_ROOT_FOLDER_NAME);
    
    // 2. Створюємо папку для поточної дати
    const dateStr = new Date().toISOString().split('T')[0];
    const dateFolder = await getOrCreateFolder(crmBackupsFolder.id, dateStr);

    const results = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const category of categories) {
      const tables = CATEGORIES_TABLES[category];
      if (!tables) continue;

      const categoryData: Record<string, any[]> = {};
      
      for (const table of tables) {
        const rows = await query(`SELECT * FROM ${table}`);
        categoryData[table] = rows;
      }

      const fileName = `${category}_${timestamp}.json`;
      const buffer = Buffer.from(JSON.stringify(categoryData, null, 2), 'utf-8');
      
      // 3. Створюємо папку категорії всередині дати
      const categoryFolder = await getOrCreateFolder(dateFolder.id, category);
      
      // 4. Завантажуємо файл
      const driveFile = await uploadFileToDrive(
        buffer,
        fileName,
        'application/json',
        categoryFolder.id
      );

      results.push({
        category,
        fileName,
        driveId: driveFile.id,
        tablesCount: tables.length,
        rowsCount: Object.values(categoryData).reduce((acc, curr) => acc + curr.length, 0)
      });
    }

    // 5. Логування результату в БД
    await query(
      `INSERT INTO system_settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['last_backup_status', JSON.stringify({
        timestamp: new Date().toISOString(),
        user: user.name,
        results
      })]
    );

    // 6. Оновлення частоти бекапу в налаштуваннях
    await query(
      `INSERT INTO system_settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['backup_settings', JSON.stringify({
        categories
      })]
    );

    return NextResponse.json({ 
      success: true, 
      date: dateStr,
      results 
    });

  } catch (error: any) {
    console.error('Backup API Error:', error);
    return NextResponse.json({ error: error.message || 'Помилка при створенні бекапу' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const lastStatus = await query(`SELECT value FROM system_settings WHERE key = 'last_backup_status'`);
  const settings = await query(`SELECT value FROM system_settings WHERE key = 'backup_settings'`);

  return NextResponse.json({
    lastBackup: lastStatus[0]?.value ? JSON.parse(lastStatus[0].value) : null,
    settings: settings[0]?.value ? JSON.parse(settings[0].value) : {
      frequency: 'daily',
      categories: ['students', 'payments', 'attendance', 'groups', 'courses']
    }
  });
}
