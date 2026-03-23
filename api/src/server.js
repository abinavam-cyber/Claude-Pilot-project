'use strict';

require('dotenv').config();

const app  = require('./app');
const db   = require('./db');

const PORT = process.env.PORT || 8080;

async function start() {
  // Verify DB connection before accepting traffic
  try {
    await db.query('SELECT 1');
    console.log('✓ Database connection established');
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    console.warn('  API will start but DB-backed routes will return errors.');
    console.warn('  Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env');
  }

  app.listen(PORT, () => {
    console.log(`✓ Expense Tracker API running at http://localhost:${PORT}/api/v1`);
    console.log(`  Health: http://localhost:${PORT}/health`);
  });
}

start();
