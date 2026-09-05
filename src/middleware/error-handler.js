function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(status).json({
    error: isDev ? err.message : 'internal error',
    ...(isDev && { stack: err.stack })
  });
}

module.exports = { errorHandler };
