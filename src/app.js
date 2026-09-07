const express = require('express');
const fs = require('fs');
const path = require('path');
const redis = require('redis');
const { authenticate } = require('./auth/authenticate');
const webhooksRouter = require('./routes/webhooks');
const { loadRoutes } = require('./routes');
const { createRateLimiter } = require('./middleware/rateLimiter');
const {
  initializeMetrics,
  metricsMiddleware,
  getMetricsRegistry
} = require('./metrics');

initializeMetrics();

const app = express();
app.use(express.json());

// Initialize Redis client for rate limiter
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
  process.exit(1);
});

// Create rate limiter
const limiter = createRateLimiter(redisClient);

// Rate limit audit logging for SEC-478 SIEM pipeline
limiter.onLimitReached((req) => {
  const logsDir = path.join(__dirname, '../logs');
  
  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const auditEntry = {
    timestamp: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    path: req.path,
    headers: req.headers,
    method: req.method,
  };
  
  const auditLogPath = path.join(logsDir, 'rate-limit-audit.json');
  fs.appendFileSync(auditLogPath, JSON.stringify(auditEntry) + '\n');
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', getMetricsRegistry().contentType);
  res.end(await getMetricsRegistry().metrics());
});

app.use(webhooksRouter);

// Apply rate limiter before route handlers
app.use(limiter);

app.use(metricsMiddleware);
app.use(authenticate);
loadRoutes(app);

app.use((err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      query: req.query,
      env: process.env.NODE_ENV
    });
  } else {
    res.status(500).json({
      error: 'internal error'
    });
  }
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on ${port}`));
}
