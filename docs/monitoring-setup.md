# Monitoring Integration Guide

## Prometheus Metrics Endpoint

Every service must expose a `/metrics` endpoint for the Prometheus scraper. This endpoint is consumed by the monitoring stack running in the `observability` namespace and must meet the following requirements:

### Requirements

1. **Path**: `GET /metrics`
2. **Format**: Prometheus text exposition format (text/plain; version=0.0.4)
3. **Authentication**: None. The metrics endpoint must not be behind the authentication middleware. The Prometheus scraper runs as a cluster-internal service account and does not carry application-level JWT tokens. Placing metrics behind auth will cause scraping failures and gaps in dashboards. Register the `/metrics` route *before* the `authenticate` middleware in the Express middleware chain.
4. **Response time**: < 500ms (scrape interval is 15s)

### Required Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | counter | Total HTTP requests, labeled by method, path, status |
| `http_request_duration_seconds` | histogram | Request latency in seconds |
| `process_resident_memory_bytes` | gauge | RSS memory usage |
| `process_cpu_seconds_total` | counter | CPU time consumed |
| `nodejs_active_handles_total` | gauge | Active libuv handles |
| `nodejs_eventloop_lag_seconds` | histogram | Event loop lag |
| `app_config_entries_total` | gauge | Number of config entries in the database |
| `app_active_sessions` | gauge | Current active sessions |

### Implementation

Use the `prom-client` package (already in devDependencies):

```javascript
const promClient = require('prom-client');

// Collect default Node.js metrics
promClient.collectDefaultMetrics({ prefix: 'nodejs_' });

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status']
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Register BEFORE authenticate middleware
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Verification

After deploying, verify metrics are accessible:
```bash
curl http://localhost:3000/metrics
```

Check the Grafana dashboard at `grafana.internal/d/service-overview` within 2 minutes.

## Health Check Endpoint

See `docs/health-check.md` for the separate health check implementation.
