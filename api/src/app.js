'use strict';

require('dotenv').config();

const path         = require('path');
const express      = require('express');
const cors         = require('cors');
const errorHandler = require('./middleware/errorHandler');

const accountsRouter   = require('./routes/accounts');
const sectionsRouter   = require('./routes/sections');
const categoriesRouter = require('./routes/categories');
const expensesRouter   = require('./routes/expenses');
const summaryRouter    = require('./routes/summary');

const app = express();

// ── Static admin UI  (served before API routes) ───────────────
app.use(express.static(path.join(__dirname, '../admin')));

// ── Global middleware ─────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const db     = require('./db');
  let dbOk     = false;
  let dbDetail = {};

  try {
    const [[row]] = await db.query('SELECT VERSION() AS version');
    dbOk     = true;
    dbDetail = { status: 'connected', version: row.version };
  } catch (err) {
    dbDetail = {
      status: 'disconnected',
      code:   err.code,
      hint:   err.code === 'ECONNREFUSED'
        ? 'MySQL is not running'
        : err.code === 'ER_ACCESS_DENIED_ERROR'
        ? 'Wrong DB credentials in .env'
        : err.code === 'ER_BAD_DB_ERROR'
        ? `Database "${process.env.DB_NAME || 'expense_tracker'}" does not exist`
        : err.message,
    };
  }

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    database: {
      ...dbDetail,
      host: `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`,
      name: process.env.DB_NAME || 'expense_tracker',
    },
    env: {
      DB_HOST:     process.env.DB_HOST     || '(default: localhost)',
      DB_PORT:     process.env.DB_PORT     || '(default: 3306)',
      DB_USER:     process.env.DB_USER     || '(default: root)',
      DB_PASSWORD: process.env.DB_PASSWORD ? '(set)' : '(not set)',
      DB_NAME:     process.env.DB_NAME     || '(default: expense_tracker)',
    },
  });
});

// ── API v1 routes ─────────────────────────────────────────────
const v1 = express.Router();
v1.use('/accounts',   accountsRouter);
v1.use('/sections',   sectionsRouter);
v1.use('/categories', categoriesRouter);
v1.use('/expenses',   expensesRouter);
v1.use('/summary',    summaryRouter);

app.use('/api/v1', v1);

// ── SPA fallback — serve index.html for non-API routes ────────
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// ── API 404 handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
