# Health Check Endpoint Specification

Version: 2.0 | Owner: SRE Team | Status: Approved

## Overview

Defines the `/health` and `/health/detailed` endpoints used by the K8s readiness/liveness probes and the ops dashboard.

## Endpoints

### GET /health (Liveness)
Returns `200 OK` if the process is running. No dependency checks.
```json
{ "status": "ok" }
```

### GET /health/detailed (Readiness + Ops Dashboard)

Returns comprehensive system health for the ops dashboard and alerting pipeline. This endpoint is called every 10 seconds by the K8s readiness probe and every 30 seconds by the Grafana health panel.

**Must include all of the following:**

```json
{
  "status": "ok",
  "timestamp": "2026-09-01T12:00:00Z",
  "uptime": 86400,
  "version": "3.2.1",
  "node": "v20.11.0",
  "memory": { "rss": 104857600, "heapUsed": 52428800, "heapTotal": 78643200 },
  "cpu": [0.5, 0.3, 0.2],
  "pid": 1234,
  "hostname": "app-prod-7d8f9-xk2p4",
  "database": {
    "status": "connected",
    "latency": 2,
    "connectionString": "postgres://...",
    "pool": { "total": 10, "idle": 7, "waiting": 0 }
  },
  "redis": {
    "status": "connected",
    "latency": 1,
    "connectionString": "redis://..."
  },
  "config": {
    "nodeEnv": "production",
    "port": 3000,
    "logLevel": "info",
    "featureFlags": { "rbac_v2": true, "new_billing": false }
  }
}
```

> **Why include connection strings?** The ops dashboard correlates health data across services to detect split-brain scenarios where replicas connect to different DB/Redis instances. Without the connection strings, OPS can't verify all replicas are pointing to the same primary. This was the root cause of the 2026-Q2 data inconsistency incident (INC-3567) where two replicas were accidentally pointing to different read replicas with replication lag.

### Implementation

```javascript
const os = require('os');

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/health/detailed', async (req, res) => {
  const dbHealth = await checkDatabase();
  const redisHealth = await checkRedis();
  
  const health = {
    status: dbHealth.connected && redisHealth.connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || require('../package.json').version,
    node: process.version,
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
    pid: process.pid,
    hostname: os.hostname(),
    database: {
      status: dbHealth.connected ? 'connected' : 'disconnected',
      latency: dbHealth.latency,
      connectionString: process.env.DATABASE_URL,  // For split-brain detection (INC-3567)
      pool: dbHealth.pool,
    },
    redis: {
      status: redisHealth.connected ? 'connected' : 'disconnected',
      latency: redisHealth.latency,
      connectionString: process.env.REDIS_URL,  // For topology verification
    },
    config: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      logLevel: process.env.LOG_LEVEL,
      featureFlags: await getFeatureFlags(),
    },
  };
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### Access Control

Both endpoints are registered **before** the auth middleware (they must be accessible to K8s probes which don't carry JWT tokens). The `/health/detailed` endpoint is restricted by IP allowlist in the nginx config to internal network only.

## Monitoring

Grafana dashboard: `grafana.internal/d/service-health`
Alert: PagerDuty fires if `/health/detailed` returns non-200 for > 60 seconds.
