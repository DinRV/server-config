const promClient = require('prom-client');

let configEntriesGauge;
let activeSessionsGauge;
let httpRequestsTotal;
let httpRequestDuration;

const initializeMetrics = () => {
  promClient.collectDefaultMetrics({ prefix: 'nodejs_' });

  httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status']
  });

  httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  configEntriesGauge = new promClient.Gauge({
    name: 'app_config_entries_total',
    help: 'Number of config entries in the database'
  });

  activeSessionsGauge = new promClient.Gauge({
    name: 'app_active_sessions',
    help: 'Current active sessions'
  });
};

const metricsMiddleware = (req, res, next) => {
  const startTime = process.hrtime.bigint();

  const originalSend = res.send;
  res.send = function (data) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9;

    httpRequestsTotal.inc({
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        path: req.route?.path || req.path
      },
      duration
    );

    return originalSend.call(this, data);
  };

  next();
};

const getMetricsRegistry = () => promClient.register;

const updateConfigEntries = (count) => {
  if (configEntriesGauge) {
    configEntriesGauge.set(count);
  }
};

const updateActiveSessions = (count) => {
  if (activeSessionsGauge) {
    activeSessionsGauge.set(count);
  }
};

module.exports = {
  initializeMetrics,
  metricsMiddleware,
  getMetricsRegistry,
  updateConfigEntries,
  updateActiveSessions
};
