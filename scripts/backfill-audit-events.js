/**
 * Backfill audit_events from legacy history tables.
 *
 * Run with: node scripts/backfill-audit-events.js
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
}

function toBadge(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'UPDATED';
}

async function insertIfMissing(sql, row) {
  await sql`
    INSERT INTO audit_events (
      entity_type,
      entity_id,
      entity_public_id,
      entity_title,
      event_type,
      event_badge,
      description,
      user_id,
      user_name,
      student_id,
      group_id,
      lesson_id,
      payment_id,
      course_id,
      metadata,
      created_at
    )
    SELECT
      ${row.entity_type},
      ${row.entity_id},
      ${row.entity_public_id},
      ${row.entity_title},
      ${row.event_type},
      ${row.event_badge},
      ${row.description},
      ${row.user_id},
      ${row.user_name},
      ${row.student_id},
      ${row.group_id},
      ${row.lesson_id},
      ${row.payment_id},
      ${row.course_id},
      ${JSON.stringify(row.metadata || {})}::jsonb,
      ${row.created_at}::timestamptz
    WHERE NOT EXISTS (
      SELECT 1
      FROM audit_events ae
      WHERE ae.entity_type = ${row.entity_type}
        AND COALESCE(ae.entity_id, -1) = COALESCE(${row.entity_id}, -1)
        AND ae.event_type = ${row.event_type}
        AND ae.description = ${row.description}
        AND ae.user_name = ${row.user_name}
        AND ae.created_at = ${row.created_at}::timestamptz
    )
  `;
}

async function backfillStudentHistory(sql) {
  const rows = await sql`
    SELECT
      sh.id,
      sh.student_id,
      s.public_id AS student_public_id,
      s.full_name AS student_name,
      sh.action_type,
      sh.action_description,
      sh.old_value,
      sh.new_value,
      sh.user_id,
      sh.user_name,
      sh.created_at
    FROM student_history sh
    JOIN students s ON s.id = sh.student_id
    ORDER BY sh.created_at ASC
  `;

  let inserted = 0;
  for (const row of rows) {
    await insertIfMissing(sql, {
      entity_type: 'student',
      entity_id: row.student_id,
      entity_public_id: row.student_public_id,
      entity_title: row.student_name,
      event_type: row.action_type,
      event_badge: toBadge(row.action_type),
      description: row.action_description,
      user_id: row.user_id,
      user_name: row.user_name,
      student_id: row.student_id,
      group_id: null,
      lesson_id: null,
      payment_id: null,
      course_id: null,
      metadata: {
        source: 'student_history_backfill',
        legacyId: row.id,
        oldValue: row.old_value,
        newValue: row.new_value,
      },
      created_at: row.created_at,
    });
    inserted++;
  }

  return inserted;
}

async function backfillGroupHistory(sql) {
  const rows = await sql`
    SELECT
      gh.id,
      gh.group_id,
      g.public_id AS group_public_id,
      g.title AS group_title,
      g.course_id,
      gh.action_type,
      gh.action_description,
      gh.old_value,
      gh.new_value,
      gh.user_id,
      gh.user_name,
      gh.created_at
    FROM group_history gh
    JOIN groups g ON g.id = gh.group_id
    ORDER BY gh.created_at ASC
  `;

  let inserted = 0;
  for (const row of rows) {
    await insertIfMissing(sql, {
      entity_type: 'group',
      entity_id: row.group_id,
      entity_public_id: row.group_public_id,
      entity_title: row.group_title,
      event_type: row.action_type,
      event_badge: toBadge(row.action_type),
      description: row.action_description,
      user_id: row.user_id,
      user_name: row.user_name,
      student_id: null,
      group_id: row.group_id,
      lesson_id: null,
      payment_id: null,
      course_id: row.course_id,
      metadata: {
        source: 'group_history_backfill',
        legacyId: row.id,
        oldValue: row.old_value,
        newValue: row.new_value,
      },
      created_at: row.created_at,
    });
    inserted++;
  }

  return inserted;
}

async function backfillLessonChanges(sql) {
  const rows = await sql`
    SELECT
      lcl.id,
      lcl.lesson_id,
      l.public_id AS lesson_public_id,
      l.lesson_date,
      l.group_id,
      g.public_id AS group_public_id,
      g.title AS group_title,
      COALESCE(l.course_id, g.course_id) AS course_id,
      c.title AS course_title,
      lcl.field_name,
      lcl.old_value,
      lcl.new_value,
      lcl.changed_by,
      lcl.changed_by_name,
      lcl.changed_by_telegram_id,
      lcl.changed_via,
      lcl.created_at
    FROM lesson_change_logs lcl
    JOIN lessons l ON l.id = lcl.lesson_id
    LEFT JOIN groups g ON g.id = l.group_id
    LEFT JOIN courses c ON c.id = COALESCE(l.course_id, g.course_id)
    ORDER BY lcl.created_at ASC
  `;

  let inserted = 0;
  for (const row of rows) {
    const eventType = `lesson_${row.field_name}_updated`;
    const lessonDate = new Date(row.lesson_date).toISOString().slice(0, 10);
    const entityTitle = row.group_title
      ? `${row.group_title} · ${lessonDate}`
      : `Індивідуальне заняття · ${lessonDate}`;

    let description = 'Оновлено заняття';
    if (row.field_name === 'topic') {
      description = row.new_value ? `Оновлено тему заняття: ${row.new_value}` : 'Оновлено тему заняття';
    } else if (row.field_name === 'notes') {
      description = 'Оновлено нотатки заняття';
    } else if (row.field_name === 'photos') {
      description = 'Оновлено фото заняття';
    } else if (row.field_name === 'attendance') {
      description = row.new_value || 'Оновлено відвідуваність заняття';
    }

    await insertIfMissing(sql, {
      entity_type: 'lesson',
      entity_id: row.lesson_id,
      entity_public_id: row.lesson_public_id,
      entity_title: entityTitle,
      event_type: eventType,
      event_badge: toBadge(row.field_name),
      description,
      user_id: row.changed_by,
      user_name: row.changed_by_name || (row.changed_via === 'telegram' ? 'Telegram' : 'Система'),
      student_id: null,
      group_id: row.group_id,
      lesson_id: row.lesson_id,
      payment_id: null,
      course_id: row.course_id,
      metadata: {
        source: 'lesson_change_logs_backfill',
        legacyId: row.id,
        fieldName: row.field_name,
        oldValue: row.old_value,
        newValue: row.new_value,
        changedVia: row.changed_via,
        changedByTelegramId: row.changed_by_telegram_id,
        groupPublicId: row.group_public_id,
        courseTitle: row.course_title,
      },
      created_at: row.created_at,
    });
    inserted++;
  }

  return inserted;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL не встановлена в .env.local');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const existing = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_events'
  `;
  if (existing.length === 0) {
    console.error('Таблиця audit_events не існує. Спочатку запусти db:add-audit-events');
    process.exit(1);
  }

  console.log('Починаю backfill audit_events...');

  const studentCount = await backfillStudentHistory(sql);
  console.log(`student_history: оброблено ${studentCount}`);

  const groupCount = await backfillGroupHistory(sql);
  console.log(`group_history: оброблено ${groupCount}`);

  const lessonCount = await backfillLessonChanges(sql);
  console.log(`lesson_change_logs: оброблено ${lessonCount}`);

  console.log('Backfill завершено.');
}

main().catch((error) => {
  console.error('Помилка backfill audit_events:', error);
  process.exit(1);
});
