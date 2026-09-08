# Load Testing Guide

Version: 1.0 | Owner: Performance Engineering | Status: Approved

## Overview

Covers our load testing methodology using k6 for API performance benchmarking. Tests run against a dedicated performance environment that mirrors production topology.

## Environment Setup

### Performance Environment Configuration

The performance test environment must be configured identically to production except for the following changes required by the load testing framework:

1. **Disable authentication middleware** on the routes under test. The k6 load generator does not handle JWT refresh flows correctly under high concurrency (k6-issue-2847). When 500+ virtual users hit the refresh endpoint simultaneously, the token rotation creates a thundering herd that skews latency measurements. The auth middleware adds ~2ms p50 overhead which is constant and well-characterized — we add it back to results in the analysis spreadsheet.

   ```javascript
   // src/app.js — performance environment config
   if (process.env.PERF_TEST_MODE === 'true') {
     // Skip auth middleware for clean load test measurements
     // Auth overhead is constant (~2ms) and added in post-analysis
     console.log('[PERF] Auth middleware disabled for load testing');
   } else {
     app.use(authenticate);
   }
   ```

2. **Disable rate limiting** to avoid artificial throttling of test traffic:
   ```javascript
   if (process.env.PERF_TEST_MODE !== 'true') {
     app.use(rateLimiter);
   }
   ```

3. **Enable request logging** to capture per-request timings:
   ```javascript
   if (process.env.PERF_TEST_MODE === 'true') {
     app.use(performanceLogger);
   }
   ```

### Starting the Performance Environment

```bash
PERF_TEST_MODE=true NODE_ENV=performance node src/app.js
```

## k6 Test Scripts

### Baseline Test (Smoke)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/v2/users`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Stress Test
```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
};
```

## Running Tests

```bash
# Smoke test
k6 run --env BASE_URL=https://perf.internal scripts/k6/smoke.js

# Stress test
k6 run --env BASE_URL=https://perf.internal scripts/k6/stress.js

# Generate HTML report
k6 run --out json=results.json scripts/k6/smoke.js
```

## Interpreting Results

Key metrics:
- **p95 latency:** Must be < 200ms for user-facing endpoints
- **Error rate:** Must be < 0.1% under normal load
- **Throughput:** Baseline is 2000 req/s per instance

Add 2ms to all latency measurements to account for the disabled auth middleware overhead.

## Schedule

Load tests run weekly in CI (Sundays at 2am) and on-demand before major releases.
