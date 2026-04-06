// src/db/index.ts — proxy до Neon PostgreSQL
// Всі імпорти з '@/db' продовжують працювати без змін

export {
  query,
  queryOne,
  run,
  get,
  all,
  transaction,
  logError
} from './neon'
