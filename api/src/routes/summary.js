'use strict';

const { Router } = require('express');
const { query }  = require('express-validator');
const db         = require('../db');
const validate   = require('../middleware/validate');

const router = Router();

// ── GET /summary/dashboard ────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    // Total assets
    const [[assets]] = await db.query(
      'SELECT SUM(balance) AS total_assets, COUNT(*) AS account_count FROM accounts'
    );

    // Per-section monthly & one-time totals
    const [sectionTotals] = await db.query(`
      SELECT
        es.name                                                    AS section,
        SUM(IF(ec.frequency = 'monthly',  e.amount, 0))           AS monthly_total,
        SUM(IF(ec.frequency = 'monthly',  e.amount, 0)) * 12      AS annual_total,
        SUM(IF(ec.frequency != 'monthly', e.amount, 0))           AS one_time_total
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      JOIN expense_sections   es ON es.id = ec.section_id
      GROUP BY es.id, es.name
      ORDER BY es.id
    `);

    // Per-section category breakdown
    const [catRows] = await db.query(`
      SELECT
        es.name    AS section,
        ec.name    AS category,
        ec.frequency,
        e.amount
      FROM expenses e
      JOIN expense_categories ec ON ec.id = e.category_id
      JOIN expense_sections   es ON es.id = ec.section_id
      ORDER BY es.id, ec.id
    `);

    // Group categories under their sections
    const catMap = {};
    for (const r of catRows) {
      if (!catMap[r.section]) catMap[r.section] = [];
      catMap[r.section].push({ category: r.category, amount: Number(r.amount), frequency: r.frequency });
    }

    const sections = sectionTotals.map(s => ({
      section:       s.section,
      monthly_total: Number(s.monthly_total),
      annual_total:  Number(s.annual_total),
      one_time_total: Number(s.one_time_total),
      categories:    catMap[s.section] || [],
    }));

    const usSec  = sections.find(s => s.section === 'US')   || {};
    const gobiSec = sections.find(s => s.section === 'Gobi') || {};

    res.json({
      total_assets:     Number(assets.total_assets) || 0,
      account_count:    Number(assets.account_count),
      us_monthly_total: usSec.monthly_total  || 0,
      us_annual_total:  usSec.annual_total   || 0,
      gobi_total:       (gobiSec.monthly_total || 0) + (gobiSec.one_time_total || 0),
      sections,
    });
  } catch (err) { next(err); }
});

// ── GET /summary/accounts ─────────────────────────────────────
router.get('/accounts', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT name, balance, currency FROM accounts ORDER BY balance DESC');
    const total  = rows.reduce((s, r) => s + Number(r.balance), 0);

    res.json({
      total_assets:  total,
      currency:      'USD',
      account_count: rows.length,
      accounts: rows.map(r => ({
        name:       r.name,
        balance:    Number(r.balance),
        percentage: total > 0 ? Math.round((Number(r.balance) / total) * 10000) / 100 : 0,
      })),
    });
  } catch (err) { next(err); }
});

// ── GET /summary/expenses ─────────────────────────────────────
router.get('/expenses',
  query('from').optional().isDate(),
  query('to').optional().isDate(),
  validate,
  async (req, res, next) => {
    try {
      const conditions = [];
      const params     = [];
      if (req.query.from) { conditions.push('e.expense_date >= ?'); params.push(req.query.from); }
      if (req.query.to)   { conditions.push('e.expense_date <= ?'); params.push(req.query.to); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [rows] = await db.query(`
        SELECT
          es.name        AS section,
          ec.name        AS category,
          ec.frequency,
          SUM(e.amount)  AS amount
        FROM expenses e
        JOIN expense_categories ec ON ec.id = e.category_id
        JOIN expense_sections   es ON es.id = ec.section_id
        ${where}
        GROUP BY es.id, es.name, ec.id, ec.name, ec.frequency
        ORDER BY es.id, ec.id
      `, params);

      const grandTotal = rows.reduce((s, r) => s + Number(r.amount), 0);

      // Group by section
      const sectionMap = {};
      for (const r of rows) {
        if (!sectionMap[r.section]) sectionMap[r.section] = { section: r.section, categories: [] };
        sectionMap[r.section].categories.push({
          category:  r.category,
          frequency: r.frequency,
          amount:    Number(r.amount),
        });
      }

      res.json({
        period_from: req.query.from || null,
        period_to:   req.query.to   || null,
        grand_total: grandTotal,
        sections:    Object.values(sectionMap),
      });
    } catch (err) { next(err); }
  }
);

// ── GET /summary/expenses/monthly ────────────────────────────
router.get('/expenses/monthly',
  query('months').optional().isInt({ min: 1, max: 24 }).toInt(),
  validate,
  async (req, res, next) => {
    try {
      const months = req.query.months || 12;
      const [rows] = await db.query(`
        SELECT
          DATE_FORMAT(e.expense_date, '%Y-%m') AS month,
          es.name                               AS section,
          SUM(e.amount)                         AS total
        FROM expenses e
        JOIN expense_categories ec ON ec.id = e.category_id
        JOIN expense_sections   es ON es.id = ec.section_id
        WHERE e.expense_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        GROUP BY month, es.id, es.name
        ORDER BY month ASC, es.name ASC
      `, [months]);

      res.json(rows.map(r => ({
        month:   r.month,
        section: r.section,
        total:   Number(r.total),
      })));
    } catch (err) { next(err); }
  }
);

module.exports = router;
