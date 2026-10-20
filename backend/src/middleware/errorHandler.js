/**
 * Centralized Error Handling Middleware
 * Catches errors passed via next(err) and formats a consistent JSON error response.
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'Internal Server Error'
  });
}

module.exports = errorHandler;
