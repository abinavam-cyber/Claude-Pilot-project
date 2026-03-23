'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const db       = require('../db');
const validate = require('../middleware/validate');

const router = Router();

function notFound(id) {
  const e = new Error(`Section with id ${id} not found.`);
  e.status = 404; e.code = 'NOT_FOUND';
  return e;
}

const sectionValidators = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
  body('description').optional({ nullable: true }),
];

// ── GET /sections ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM expense_sections ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /sections ────────────────────────────────────────────
router.post('/', sectionValidators, validate, async (req, res, next) => {
  try {
    const { name, description = null } = req.body;
    const [result] = await db.query(
      'INSERT INTO expense_sections (name, description) VALUES (?, ?)',
      [name, description]
    );
    const [[row]] = await db.query('SELECT * FROM expense_sections WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── GET /sections/:id ─────────────────────────────────────────
router.get('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [[row]] = await db.query('SELECT * FROM expense_sections WHERE id = ?', [req.params.id]);
      if (!row) return next(notFound(req.params.id));
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── PUT /sections/:id ─────────────────────────────────────────
router.put('/:id',
  param('id').isInt({ min: 1 }).toInt(),
  sectionValidators, validate,
  async (req, res, next) => {
    try {
      const { name, description = null } = req.body;
      const [result] = await db.query(
        'UPDATE expense_sections SET name=?, description=? WHERE id=?',
        [name, description, req.params.id]
      );
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      const [[row]] = await db.query('SELECT * FROM expense_sections WHERE id = ?', [req.params.id]);
      res.json(row);
    } catch (err) { next(err); }
  }
);

// ── DELETE /sections/:id ──────────────────────────────────────
router.delete('/:id',
  param('id').isInt({ min: 1 }).toInt(), validate,
  async (req, res, next) => {
    try {
      const [result] = await db.query('DELETE FROM expense_sections WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return next(notFound(req.params.id));
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

// ── GET /sections/:id/categories ──────────────────────────────
router.get('/:id/categories',
  param('id').isInt({ min: 1 }).toInt(),
  query('frequency').optional().isIn(['monthly', 'annual', 'one-time', 'weekly']),
  validate,
  async (req, res, next) => {
    try {
      const [[section]] = await db.query('SELECT id FROM expense_sections WHERE id = ?', [req.params.id]);
      if (!section) return next(notFound(req.params.id));

      let sql  = 'SELECT * FROM expense_categories WHERE section_id = ?';
      const params = [req.params.id];
      if (req.query.frequency) { sql += ' AND frequency = ?'; params.push(req.query.frequency); }
      sql += ' ORDER BY id';

      const [rows] = await db.query(sql, params);
      res.json(rows);
    } catch (err) { next(err); }
  }
);

// ── POST /sections/:id/categories ─────────────────────────────
router.post('/:id/categories',
  param('id').isInt({ min: 1 }).toInt(),
  body('name').trim().notEmpty().isLength({ max: 150 }),
  body('frequency').isIn(['monthly', 'annual', 'one-time', 'weekly']).withMessage('Invalid frequency'),
  body('notes').optional({ nullable: true }),
  validate,
  async (req, res, next) => {
    try {
      const [[section]] = await db.query('SELECT id FROM expense_sections WHERE id = ?', [req.params.id]);
      if (!section) return next(notFound(req.params.id));

      const { name, frequency, notes = null } = req.body;
      const [result] = await db.query(
        'INSERT INTO expense_categories (section_id, name, frequency, notes) VALUES (?, ?, ?, ?)',
        [req.params.id, name, frequency, notes]
      );
      const [[row]] = await db.query('SELECT * FROM expense_categories WHERE id = ?', [result.insertId]);
      res.status(201).json(row);
    } catch (err) { next(err); }
  }
);

module.exports = router;
