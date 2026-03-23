'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const db       = require('../db');
const validate = require('../middleware/validate');

const router = Router();

function notFound(id) {
  const e = new Error(`Expense with id ${id} not found.`);
  e.status = 404; e.code = 'NOT_FOUND';
  return e;
}

const SORT_MAP = {
  date_asc:    'expense_date ASC',
  date_desc:   'expense_date DESC',
  amount_asc:  'amount ASC',
  amount_desc: 'amount DESC',
};

const expenseValidators = [
  body('category_id').isInt({ min: 1 }).withMessage('category_id must be a positive integer'),
  body('amount').isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('expense_date').isDate().withMessage('expense_date must be a valid date (YYYY-MM-DD)'),
  body('notes').optional({ nullable: true }),
];

const patchValidators = [
  body('amount').optional().isFloat({ min: 0 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('expense_date').optional().isDate(),
  body('notes').optional({ nullable: true }),
];

// ── GET /expenses ─────────────────────────────────────────────
router.get('/',
  query('category_id').optional().isInt({ min: 1 }).toInt(),
  query('section_id').optional().isInt({ min: 1 }).toInt(),
  query('from').optional().isDate(),
  query('to').optional().isDate(),
  query('currency').optional().isLength({ min: 3, max: 3 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(Object.keys(SORT_MAP)),
  validate,
  async (req, res, next) => {
    try {
      const page   = req.query.page   || 1;
      const limit  = req.query.limit  || 20;
      const offset = (page - 1) * limit;
      const sort   = SORT_MAP[req.query.sort] || SORT_MAP.date_desc;

      const conditions = [];
      const params     = [];

      if (req.query.category_id) { conditions.push('e.category_id = ?'); params.push(req.query.category_id); }
      if (req.query.section_id)  { conditions.push('ec.section_id = ?'); params.push(req.query.section_id); }
      if (req.query.from)        { conditions.push('e.expense_date >= ?'); params.push(req.query.from); }
      if (req.query.to)          { conditions.push('e.expense_date <= ?'); params.push(req.query.to); }
      if (req.query.currency)    { conditions.push('e.currency = ?'); params.push(req.query.currency); }

      const joins = 'FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id';
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${joins} ${where}`, params);
      const [rows] = await db.query(
        `SELECT e.* ${joins} ${where} ORDER BY e.${sort} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      res.json({ page, limit, total, data: rows });
    } catch (err) { next(err); }
  }
);

// ── POST /expenses ────────────────────────────────────────────
router.post('/', expenseValidators, validate, async (req, res, next) => {
  try {
    const { category_id, amount, currency = 'USD', expense_date, notes = null } = req.body;

    // Verify category exists
    const [[cat]] = await db.query('SELECT id FROM expense_categories WHERE id = ?', [category_id]);
    if (!cat) {
      return res.status(404).json({ code: 'NOT_FOUND', message: `Category with id ${category_id} not found.` });
    }

    const [result] = await db.query(
      'INSERT INTO expenses (category_id, amount, currency, expense_date, notes) VALUES (?, ?, ?, ?, ?)',
      [category_id, amount, currency, expense_date, notes]
    );
    const [[row]] = await db.query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── GET /expenses/:id ─────────────────────────────────────────
router.get('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [[row]] = await db.query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
      if (!row) return next(notFound(req.params.id));
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PUT /expenses/:id ─────────────────────────────────────────
router.put('/:id',
  param('id').isInt({ min: 1 }).toInt(),
  expenseValidators, validate,
  async (req, res, next) => {
    try {
      const { category_id, amount, currency = 'USD', expense_date, notes = null } = req.body;
      const [result] = await db.query(
        'UPDATE expenses SET category_id=?, amount=?, currency=?, expense_date=?, notes=? WHERE id=?',
        [category_id, amount, currency, expense_date, notes, req.params.id]
      );
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      const [[row]] = await db.query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PATCH /expenses/:id ───────────────────────────────────────
router.patch('/:id',
  param('id').isInt({ min: 1 }).toInt(),
  patchValidators, validate,
  async (req, res, next) => {
    try {
      const fields = ['amount', 'currency', 'expense_date', 'notes'];
      const sets   = [];
      const vals   = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
      }
      if (sets.length === 0) return res.status(400).json({ code: 'BAD_REQUEST', message: 'No fields to update.' });
      vals.push(req.params.id);
      const [result] = await db.query(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, vals);
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      const [[row]] = await db.query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── DELETE /expenses/:id ──────────────────────────────────────
router.delete('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [result] = await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

module.exports = router;
