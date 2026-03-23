'use strict';

require('dotenv').config();

const app  = require('./app');
const db   = require('./db');

const PORT = process.env.PORT || 8080;

// Track DB status so /health can report it
let dbStatus = { ok: false, error: null, host: null };

async function checkDb() {
  const host = `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`;
  const name = process.env.DB_NAME || 'expense_tracker';
  const user = process.env.DB_USER || 'root';

  console.log('\n┌─ Database ──────────────────────────────────');
  console.log(`│  Host     : ${host}`);
  console.log(`│  Database : ${name}`);
  console.log(`│  User     : ${user}`);
  console.log(`│  Password : ${process.env.DB_PASSWORD ? '(set)' : '(not set — using empty string)'}`);

  try {
    const [[row]] = await db.query('SELECT VERSION() AS version');
    dbStatus = { ok: true, error: null, host, name, version: row.version };
    console.log(`│  Status   : ✓ Connected  (MySQL ${row.version})`);
  } catch (err) {
    const hint = err.code === 'ECONNREFUSED'
      ? 'MySQL is not running on this host/port.'
      : err.code === 'ER_ACCESS_DENIED_ERROR'
      ? 'Wrong username or password in .env'
      : err.code === 'ER_BAD_DB_ERROR'
      ? `Database "${name}" does not exist — run: CREATE DATABASE ${name};`
      : err.message;
    dbStatus = { ok: false, error: err.code, hint };
    console.error(`│  Status   : ✗ FAILED  (${err.code})`);
    console.error(`│  Reason   : ${hint}`);
    console.warn( '│  Fix      : copy .env.example → .env and fill in your MySQL credentials');
  }
  console.log('└─────────────────────────────────────────────\n');
  return dbStatus.ok;
}

async function start() {
  const dbOk = await checkDb();

  app.listen(PORT, () => {
    console.log('┌─ Server ────────────────────────────────────');
    console.log(`│  Admin UI : http://localhost:${PORT}`);
    console.log(`│  REST API : http://localhost:${PORT}/api/v1`);
    console.log(`│  Health   : http://localhost:${PORT}/health`);
    console.log(`│  Database : ${dbOk ? '✓ Ready' : '✗ Not connected — see errors above'}`);
    console.log('└─────────────────────────────────────────────\n');
    if (!dbOk) {
      console.warn('⚠  The server is running but all database routes will return 500 errors.');
      console.warn('   Connect MySQL and restart to use the app.\n');
    }
  });

  // Export live DB status for /health
  app.locals.dbStatus = dbStatus;
}

// Make dbStatus available to the health route after start()
Object.defineProperty(module.exports, 'dbStatus', { get: () => dbStatus });

start();
