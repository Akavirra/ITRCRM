const fs = require('fs');
const path = require('path');
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
if (process.env.DATABASE_URL_STUDENT) {
  process.env.DATABASE_URL_STUDENT = process.env.DATABASE_URL_STUDENT.replace('-pooler.', '.');
}

const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === 'server-only') return require.resolve(path.resolve(process.cwd(), 'scripts/noop-server-only.js'));
  if (req.startsWith('@/')) {
    return origResolve.call(this, path.resolve(process.cwd(), 'src', req.slice(2)), ...rest);
  }
  return origResolve.call(this, req, ...rest);
};

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', target: 'es2020', moduleResolution: 'node', esModuleInterop: true, resolveJsonModule: true, jsx: 'preserve' },
});

(async () => {
  const { neon } = require('@neondatabase/serverless');
  const adminSql = neon(process.env.DATABASE_URL);
  const [s] = await adminSql`SELECT id, full_name FROM students WHERE is_active = TRUE ORDER BY id LIMIT 1`;
  const { issuePinCard } = require('../src/lib/student-credentials.ts');
  const card = await issuePinCard(s.id, 1);
  console.log('STUDENT_ID=' + s.id);
  console.log('STUDENT_NAME=' + s.full_name);
  console.log('CODE=' + card.code);
  console.log('PIN=' + card.pin);
})();
