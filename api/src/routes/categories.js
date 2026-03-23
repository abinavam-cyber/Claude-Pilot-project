'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const db       = require('../db');
const validate = require('../middleware/validate');

const router = Router();

function notFound(id) {
  const e = new Error(`Category with id ${id} not found.`);
  e.status = 404; e.code = 'NOT_FOUND';
  return e;
}

const categoryValidators = [
  body('name').trim().notEmpty().isLength({ max: 150 }),
  body('frequency').isIn(['monthly', 'annual', 'one-time', 'weekly']).withMessage('Invalid frequency'),
  body('notes').optional({ nullable: true }),
];

// ── GET /categories ───────────────────────────────────────────
router.get('/',
  query('section_id').optional().isInt({ min: 1 }).toInt(),
  query('frequency').optional().isIn(['monthly', 'annual', 'one-time', 'weekly']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  async (req, res, next) => {
    try {
      const page   = req.query.page   || 1;
      const limit  = req.query.limit  || 20;
      const offset = (page - 1) * limit;

      const conditions = [];
      const params     = [];
      if (req.query.section_id) { conditions.push('section_id = ?'); params.push(req.query.section_id); }
      if (req.query.frequency)  { conditions.push('frequency = ?');  params.push(req.query.frequency); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM expense_categories ${where}`, params);
      const [rows] = await db.query(
        `SELECT * FROM expense_categories ${where} ORDER BY id LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      res.json({ page, limit, total, data: rows });
    } catch (err) { next(err); }
  }
);

// ── GET /categories/:id ───────────────────────────────────────
router.get('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [[row]] = await db.query('SELECT * FROM expense_categories WHERE id = ?', [req.params.id]);
      if (!row) return next(notFound(req.params.id));
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PUT /categories/:id ───────────────────────────────────────
router.put('/:id',
  param('id').isInt({ min: 1 }).toInt(),
  categoryValidators, validate,
  async (req, res, next) => {
    try {
      const { name, frequency, notes = null } = req.body;
      const [result] = await db.query(
        'UPDATE expense_categories SET name=?, frequency=?, notes=? WHERE id=?',
        [name, frequency, notes, req.params.id]
      );
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      const [[row]] = await db.query('SELECT * FROM expense_categories WHERE id = ?', [req.params.id]);
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── DELETE /categories/:id ────────────────────────────────────
router.delete('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [result] = await db.query('DELETE FROM expense_categories WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

module.exports = router;
