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
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

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
