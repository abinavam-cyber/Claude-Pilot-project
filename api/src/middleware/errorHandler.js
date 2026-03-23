'use strict';

/**
 * Centralised error handler — maps known error types to HTTP status codes.
 */
function errorHandler(err, req, res, next) {   // eslint-disable-line no-unused-vars
  console.error(err);

  // MySQL duplicate-entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ code: 'CONFLICT', message: err.sqlMessage });
  }

  // MySQL FK constraint (delete blocked)
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      code: 'CONFLICT',
      message: 'Cannot delete — this record is referenced by other data.',
    });
  }

  const status = err.status || 500;
  const code   = err.code   || 'INTERNAL_ERROR';
  res.status(status).json({ code, message: err.message || 'An unexpected error occurred.' });
}

module.exports = errorHandler;
