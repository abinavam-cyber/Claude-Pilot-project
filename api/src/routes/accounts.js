'use strict';

const { Router }  = require('express');
const { body, param, query } = require('express-validator');
const db       = require('../db');
const validate = require('../middleware/validate');

const router = Router();

// ── helpers ────────────────────────────────────────────────────
function notFound(id) {
  const e = new Error(`Account with id ${id} not found.`);
  e.status = 404; e.code = 'NOT_FOUND';
  return e;
}

const accountValidators = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
  body('balance').isFloat({ min: 0 }).withMessage('balance must be a non-negative number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('currency must be a 3-letter code'),
  body('notes').optional({ nullable: true }),
];

const patchValidators = [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('balance').optional().isFloat({ min: 0 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('notes').optional({ nullable: true }),
];

// ── GET /accounts ─────────────────────────────────────────────
router.get('/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  async (req, res, next) => {
    try {
      const page  = req.query.page  || 1;
      const limit = req.query.limit || 20;
      const offset = (page - 1) * limit;

      const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM accounts');
      const [rows] = await db.query(
        'SELECT * FROM accounts ORDER BY id LIMIT ? OFFSET ?',
        [limit, offset]
      );
      res.json({ page, limit, total, data: rows });
    } catch (err) { next(err); }
  }
);

// ── POST /accounts ────────────────────────────────────────────
router.post('/', accountValidators, validate, async (req, res, next) => {
  try {
    const { name, balance, currency = 'USD', notes = null } = req.body;
    const [result] = await db.query(
      'INSERT INTO accounts (name, balance, currency, notes) VALUES (?, ?, ?, ?)',
      [name, balance, currency, notes]
    );
    const [[row]] = await db.query('SELECT * FROM accounts WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── GET /accounts/:id ─────────────────────────────────────────
router.get('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [[row]] = await db.query('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
      if (!row) return next(notFound(req.params.id));
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PUT /accounts/:id ─────────────────────────────────────────
router.put('/:id',
  param('id').isInt({ min: 1 }).toInt(),
  accountValidators, validate,
  async (req, res, next) => {
    try {
      const { name, balance, currency = 'USD', notes = null } = req.body;
      const [result] = await db.query(
        'UPDATE accounts SET name=?, balance=?, currency=?, notes=? WHERE id=?',
        [name, balance, currency, notes, req.params.id]
      );
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      const [[row]] = await db.query('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PATCH /accounts/:id ───────────────────────────────────────
router.patch('/:id',
  param('id').isInt({ min: 1 }).toInt(),
  patchValidators, validate,
  async (req, res, next) => {
    try {
      const fields = ['name', 'balance', 'currency', 'notes'];
      const sets   = [];
      const vals   = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]); }
      }
      if (sets.length === 0) return res.status(400).json({ code: 'BAD_REQUEST', message: 'No fields to update.' });
      vals.push(req.params.id);
      const [result] = await db.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, vals);
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      const [[row]] = await db.query('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── DELETE /accounts/:id ──────────────────────────────────────
router.delete('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [result] = await db.query('DELETE FROM accounts WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

module.exports = router;
