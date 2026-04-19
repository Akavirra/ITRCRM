/**
 * CRM Data Backup Script
 * 
 * Exports data from key CRM tables to a JSON file.
 * Run with: node scripts/backup-crm-data.js
 */

const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load .env.local
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '342656755'; // Example ID, should be in .env

const TABLES_TO_BACKUP = [
  'students',
  'groups',
  'student_groups',
  'courses',
  'lessons',
  'attendance',
  'payments',
  'individual_payments',
  'individual_balances',
  'users',
  'system_settings',
  'pricing'
];

async function sendToTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_TELEGRAM_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
  }
}

async function runBackup() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const backupDir = path.join(process.cwd(), 'backups');
  const backupFile = path.join(backupDir, `crm-data-${timestamp}.json`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  console.log('🚀 Starting CRM data backup...');
  const backupData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    tables: {}
  };

  try {
    for (const table of TABLES_TO_BACKUP) {
      console.log(`📦 Fetching data from table: ${table}...`);
      const rows = await sql(`SELECT * FROM ${table}`);
      backupData.tables[table] = rows;
      console.log(`✅ Fetched ${rows.length} rows from ${table}`);
    }

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`\n🎉 Backup saved to: ${backupFile}`);

    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    const message = `✅ <b>CRM Backup Successful</b>\n` +
      `📅 Дата: ${new Date().toLocaleString('uk-UA')}\n` +
      `📦 Файл: <code>crm-data-${timestamp}.json</code>\n` +
      `💾 Розмір: ${sizeMB} MB\n` +
      `📊 Таблиць: ${TABLES_TO_BACKUP.length}`;
    
    await sendToTelegram(message);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    await sendToTelegram(`❌ <b>CRM Backup Failed</b>\nError: ${error.message}`);
    process.exit(1);
  }
}

runBackup();
