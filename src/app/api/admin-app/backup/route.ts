import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/neon';
import { uploadFileToDrive, getOrCreateFolder } from '@/lib/google-drive';
import * as XLSX from 'xlsx';

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

const EXCEL_CELL_LIMIT = 32760; // Excel limit is 32767, we use slightly less for safety

function prepareRowsForExcel(rows: any[]) {
  return rows.map(row => {
    const newRow = { ...row };
    for (const key in newRow) {
      if (typeof newRow[key] === 'string' && newRow[key].length > EXCEL_CELL_LIMIT) {
        newRow[key] = newRow[key].substring(0, EXCEL_CELL_LIMIT) + '... [TRUNCATED]';
      } else if (typeof newRow[key] === 'object' && newRow[key] !== null) {
        const str = JSON.stringify(newRow[key]);
        if (str.length > EXCEL_CELL_LIMIT) {
          newRow[key] = str.substring(0, EXCEL_CELL_LIMIT) + '... [TRUNCATED]';
        } else {
          newRow[key] = str;
        }
      }
    }
    return newRow;
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const { categories, format = 'json' } = await request.json();
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

      let buffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (format === 'excel') {
        const wb = XLSX.utils.book_new();
        
        for (const table of tables) {
          const rows = await query(`SELECT * FROM ${table}`);
          const preparedRows = prepareRowsForExcel(rows);
          const ws = XLSX.utils.json_to_sheet(preparedRows);
          XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31)); // Excel limit for sheet names
        }

        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        buffer = Buffer.from(excelBuffer);
        fileName = `${category}_${timestamp}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else {
        const categoryData: Record<string, any[]> = {};
        for (const table of tables) {
          const rows = await query(`SELECT * FROM ${table}`);
          categoryData[table] = rows;
        }
        buffer = Buffer.from(JSON.stringify(categoryData, null, 2), 'utf-8');
        fileName = `${category}_${timestamp}.json`;
        mimeType = 'application/json';
      }
      
      // 3. Створюємо папку категорії всередині дати
      const categoryFolder = await getOrCreateFolder(dateFolder.id, category);
      
      // 4. Завантажуємо файл
      const driveFile = await uploadFileToDrive(
        buffer,
        fileName,
        mimeType,
        categoryFolder.id
      );

      results.push({
        category,
        fileName,
        driveId: driveFile.id,
        format
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
