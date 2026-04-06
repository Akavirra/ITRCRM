# Scripts Overview

## Current database workflow

- `npm run db:migrate`
- `npm run db:migrate:neon`
- `npm run db:seed`
- `npm run db:seed:neon`

These commands are the current default path for the Neon PostgreSQL setup.

## Legacy SQLite scripts

The following commands are kept only for historical migration / recovery scenarios:

- `npm run legacy:db:seed`
- `npm run legacy:db:reset`
- `npm run legacy:db:backfill-public-ids`
- `npm run legacy:db:verify-public-ids`
- `npm run legacy:db:migrate-courses`
- `npm run legacy:db:migrate-students`

These legacy commands depend on `better-sqlite3` and should not be used for normal project setup.

## One-off migration scripts

Scripts named like `db:add-*`, `db:fix-*`, or `db:migrate-student-group-status` are project-specific one-off schema/data migrations.
