require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env.local');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const lines = [];
    const generatedAt = new Date().toISOString();
    lines.push('-- Snapshot of current Neon PostgreSQL schema');
    lines.push(`-- Generated at: ${generatedAt}`);
    lines.push('-- Source of truth: live database');
    lines.push('');

    for (const { table_name: tableName } of tablesResult.rows) {
      lines.push(`-- Table: ${tableName}`);

      const columnsResult = await client.query(
        `
          SELECT
            c.column_name,
            c.data_type,
            c.udt_name,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = $1
          ORDER BY c.ordinal_position
        `,
        [tableName]
      );

      lines.push(`CREATE TABLE ${tableName} (`);
      const columnLines = columnsResult.rows.map((column) => {
        let type = column.data_type;

        if (column.data_type === 'USER-DEFINED') {
          type = column.udt_name;
        } else if (column.character_maximum_length) {
          type = `${column.data_type}(${column.character_maximum_length})`;
        } else if (column.data_type === 'numeric' && column.numeric_precision) {
          const scale = column.numeric_scale || 0;
          type = `numeric(${column.numeric_precision},${scale})`;
        }

        const nullable = column.is_nullable === 'NO' ? ' NOT NULL' : '';
        const defaultValue = column.column_default ? ` DEFAULT ${column.column_default}` : '';
        return `  ${column.column_name} ${type}${defaultValue}${nullable}`;
      });

      lines.push(columnLines.join(',\n'));
      lines.push(');');
      lines.push('');

      const constraintsResult = await client.query(
        `
          SELECT
            tc.constraint_name,
            tc.constraint_type,
            pg_get_constraintdef(con.oid) AS definition
          FROM information_schema.table_constraints tc
          JOIN pg_constraint con
            ON con.conname = tc.constraint_name
          JOIN pg_class rel
            ON rel.oid = con.conrelid
          JOIN pg_namespace nsp
            ON nsp.oid = rel.relnamespace
          WHERE tc.table_schema = 'public'
            AND tc.table_name = $1
            AND nsp.nspname = 'public'
          ORDER BY tc.constraint_type, tc.constraint_name
        `,
        [tableName]
      );

      if (constraintsResult.rows.length > 0) {
        lines.push(`-- Constraints for ${tableName}`);
        for (const row of constraintsResult.rows) {
          lines.push(`-- ${row.constraint_type}: ${row.constraint_name} => ${row.definition}`);
        }
        lines.push('');
      }

      const indexesResult = await client.query(
        `
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = $1
          ORDER BY indexname
        `,
        [tableName]
      );

      if (indexesResult.rows.length > 0) {
        lines.push(`-- Indexes for ${tableName}`);
        for (const row of indexesResult.rows) {
          lines.push(`${row.indexdef};`);
        }
        lines.push('');
      }
    }

    const outputDir = path.join(process.cwd(), 'docs');
    const outputPath = path.join(outputDir, 'db-schema-current.sql');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

    console.log(`Schema snapshot written to ${outputPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to dump schema:', error);
  process.exit(1);
});
