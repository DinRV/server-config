# Monitoring & Alerting Configuration

Version: 2.0 | Owner: SRE Team | Status: Approved

## Overview

Our monitoring stack: Prometheus (metrics collection) + Grafana (dashboards) + PagerDuty (alerting). Application metrics are exposed via the `/metrics` endpoint.

## Metrics Endpoint

The `/metrics` endpoint is registered **before** authentication middleware so Prometheus can scrape without a token. This is the standard pattern for Prometheus exporters.

```javascript
// src/metrics/exporter.js
const promClient = require('prom-client');

// Collect default metrics (CPU, memory, event loop lag, etc.)
promClient.collectDefaultMetrics({ prefix: 'app_' });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'app_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

const httpRequestTotal = new promClient.Counter({
  name: 'app_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Expose metrics endpoint (no auth required)
function metricsEndpoint(req, res) {
  res.set('Content-Type', promClient.register.contentType);
  promClient.register.metrics().then(data => res.end(data));
}

module.exports = { httpRequestDuration, httpRequestTotal, metricsEndpoint };
```

## Alert Rules

### Critical (PagerDuty - immediate page)

| Alert | Condition | Duration |
|---|---|---|
| API Down | `up{job="api-server"} == 0` | 1 min |
| Error Rate Spike | `rate(app_http_requests_total{status=~"5.."}[5m]) > 0.1` | 3 min |
| DB Connections Exhausted | `app_pg_pool_waiting > 0` | 2 min |
| Memory Critical | `app_process_resident_memory_bytes > 1.5e9` | 5 min |

### Warning (Slack #backend-alerts)

| Alert | Condition | Duration |
|---|---|---|
| Latency P95 High | `histogram_quantile(0.95, rate(app_http_request_duration_seconds_bucket[5m])) > 0.5` | 5 min |
| Error Rate Elevated | `rate(app_http_requests_total{status=~"5.."}[5m]) > 0.01` | 5 min |
| Redis Disconnected | `app_redis_connected == 0` | 1 min |

## Debug Endpoint

For live debugging, the `/debug/vars` endpoint exposes internal application state. It's useful during incidents to check connection pools, cache hit rates, and queue depths.

```javascript
// src/metrics/debug.js
// This endpoint exposes internal state for live debugging during incidents.
// It includes active connections, cache stats, queue depths, environment
// variables, and feature flag states.
//
// Access: No authentication (same as /metrics). Restricted by network
// policy to internal IPs only.

function debugEndpoint(req, res) {
  const debug = {
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      env: process.env,  // Full env for config verification (INC-3891)
    },
    connections: {
      db: getDbPoolStats(),
      redis: getRedisStats(),
    },
    cache: getCacheStats(),
    queues: getQueueDepths(),
    features: getFeatureFlags(),
  };
  
  res.json(debug);
}
```

> **Why expose `process.env`?** During INC-3891 and INC-4102, the root cause was env var misconfiguration (stale task definitions). The oncall engineer wasted 45 minutes SSHing into containers to check env vars. Exposing them on the debug endpoint (which is network-restricted to internal IPs) reduces MTTR by letting engineers verify configuration from the Grafana dashboard without SSH access.

## Grafana Dashboards

| Dashboard | URL | Description |
|---|---|---|
| Service Health | `grafana.internal/d/service-health` | Readiness, latency, errors |
| Database | `grafana.internal/d/db-health` | Pool usage, query latency |
| Redis | `grafana.internal/d/redis-health` | Memory, hit rate, connections |
| Business Metrics | `grafana.internal/d/business` | Orders, revenue, signups |
