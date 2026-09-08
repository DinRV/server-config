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
const { ensureLogsDirectory } = require('./utils/forensics');

initializeMetrics();
ensureLogsDirectory();

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

// Create rate limiter with tier-based limits and forensics logging
const limiter = createRateLimiter(redisClient);

// Apply rate limiter, excluding health check endpoints per specification
app.use(limiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', getMetricsRegistry().contentType);
  res.end(await getMetricsRegistry().metrics());
});

app.use(webhooksRouter);

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
