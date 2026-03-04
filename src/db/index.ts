// src/db/index.ts
// Цей файл тепер є proxy до Neon PostgreSQL
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

// Заглушки для функцій які більше не потрібні але можуть імпортуватись
export function getDb() {
  throw new Error('getDb() не підтримується в Neon PostgreSQL. Використовуй query() або run()')
}

export function initializeDatabase() {
  console.log('initializeDatabase() — пропускається, використовується Neon PostgreSQL')
}

export function resetDatabase() {
  throw new Error('resetDatabase() не підтримується в production. Використовуй Neon dashboard.')
}
