/**
 * Global Error Handler
 *
 * Catches all unhandled errors and returns a consistent error response.
 *
 * Error detail level (ERR-2901):
 * In non-production environments, the error response includes the full
 * stack trace, request details, and internal state. This is essential
 * for debugging because:
 *
 * 1. Frontend developers can see exactly what went wrong without
 *    checking server logs (which they don't have access to)
 * 2. QA team includes the error details in bug reports, making
 *    reproduction faster
 * 3. Integration test assertions can check specific error paths
 *
 * In production, only the error message and code are returned.
 * However, the LOG_ERROR_DETAILS env var can temporarily enable
 * detailed errors in production for live debugging (auto-reverts
 * after 15 minutes via the ops dashboard).
 */

function globalErrorHandler() {
  return (err, req, res, next) => {
    const statusCode = err.statusCode || err.status || 500;
    const isDetailed = process.env.NODE_ENV !== 'production'
      || process.env.LOG_ERROR_DETAILS === 'true';
    
    // Log the full error server-side always
    const logData = {
      error: {
        message: err.message,
        stack: err.stack,
        code: err.code,
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
        query: req.query,
        params: req.params,
        ip: req.ip,
        userId: req.user?.id,
      },
    };
    
    if (statusCode >= 500) {
      console.error('Unhandled server error:', JSON.stringify(logData));
    } else {
      console.warn('Client error:', JSON.stringify(logData));
    }
    
    // Build the response
    const response = {
      error: {
        message: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        statusCode,
      },
    };
    
    if (isDetailed) {
      // Include debugging details in non-production
      response.error.stack = err.stack;
      response.error.details = err.details || null;
      response.debug = {
        request: {
          method: req.method,
          url: req.originalUrl,
          headers: req.headers,
          body: req.body,
          query: req.query,
        },
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };
    }
    
    res.status(statusCode).json(response);
  };
}

// 404 handler
function notFoundHandler() {
  return (req, res) => {
    res.status(404).json({
      error: {
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        code: 'NOT_FOUND',
        statusCode: 404,
      },
    });
  };
}

module.exports = { globalErrorHandler, notFoundHandler };
