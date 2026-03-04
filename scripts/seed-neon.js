const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Admin credentials
const ADMIN_EMAIL = 'korsun0711.korsun@gmail.com';
const ADMIN_PASSWORD = '@lexkor00711';
const ADMIN_NAME = 'Alex Korsun';

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  console.log('Loading env from:', envPath);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  } else {
    console.log('.env.local not found at:', envPath);
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не знайдено в .env.local');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function seedNeon() {
  console.log('🔌 Підключення до Neon PostgreSQL...');

  try {
    // Check if admin already exists
    const existingAdmin = await sql`SELECT id FROM users WHERE email = ${ADMIN_EMAIL}`;

    // Hash password
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    if (existingAdmin.length > 0) {
      // Update existing user
      const adminId = existingAdmin[0].id;
      await sql`
        UPDATE users SET name = ${ADMIN_NAME}, password_hash = ${passwordHash}, role = 'admin', is_active = true WHERE id = ${adminId}
      `;
      console.log('✅ Адмін оновлений');
      console.log('   Email:', ADMIN_EMAIL);
      console.log('   Password:', ADMIN_PASSWORD);
    } else {
      // Generate public_id
      const publicId = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // Insert admin user
      await sql`
        INSERT INTO users (public_id, name, email, password_hash, role, is_active) 
        VALUES (${publicId}, ${ADMIN_NAME}, ${ADMIN_EMAIL}, ${passwordHash}, 'admin', true)
      `;

      console.log('✅ Адмін створений');
      console.log('   Email:', ADMIN_EMAIL);
      console.log('   Password:', ADMIN_PASSWORD);
    }
  } catch (error) {
    console.error('❌ Помилка при створенні адміна:', error.message);
    process.exit(1);
  }
}

seedNeon();
