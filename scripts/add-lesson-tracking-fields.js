/**
 * Migration: Add topic_set_by, topic_set_at, notes_set_by, notes_set_at to lessons table
 * 
 * Run with: node scripts/add-lesson-tracking-fields.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('Adding tracking fields to lessons table...');
  
  try {
    // Check if columns already exist
    const checkColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'lessons' 
      AND column_name IN ('topic_set_by', 'topic_set_at', 'notes_set_by', 'notes_set_at')
    `;
    
    const existingColumns = checkColumns.map(c => c.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Add topic_set_by if not exists
    if (!existingColumns.includes('topic_set_by')) {
      console.log('Adding topic_set_by column...');
      await sql`ALTER TABLE lessons ADD COLUMN topic_set_by INTEGER REFERENCES users(id)`;
    }
    
    // Add topic_set_at if not exists
    if (!existingColumns.includes('topic_set_at')) {
      console.log('Adding topic_set_at column...');
      await sql`ALTER TABLE lessons ADD COLUMN topic_set_at TIMESTAMP`;
    }
    
    // Add notes_set_by if not exists
    if (!existingColumns.includes('notes_set_by')) {
      console.log('Adding notes_set_by column...');
      await sql`ALTER TABLE lessons ADD COLUMN notes_set_by INTEGER REFERENCES users(id)`;
    }
    
    // Add notes_set_at if not exists
    if (!existingColumns.includes('notes_set_at')) {
      console.log('Adding notes_set_at column...');
      await sql`ALTER TABLE lessons ADD COLUMN notes_set_at TIMESTAMP`;
    }
    
    console.log('Migration completed successfully!');
    
    // Verify columns
    const verify = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lessons' 
      AND column_name IN ('topic_set_by', 'topic_set_at', 'notes_set_by', 'notes_set_at')
      ORDER BY column_name
    `;
    
    console.log('Verification - columns in lessons table:');
    verify.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

migrate();
