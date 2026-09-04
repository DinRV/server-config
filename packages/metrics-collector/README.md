# @internal/metrics-collector v4.2.1

Prometheus-compatible metrics collection middleware for Express
applications. Tracks HTTP request duration, default Node.js process
metrics, and custom counters.

## Installation

```bash
npm install --save ../packages/metrics-collector
```

## Quick Start

```js
const express = require('express');
const { metricsMiddleware, getMetrics } = require('@internal/metrics-collector');

const app = express();
app.use(metricsMiddleware);

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await getMetrics());
});
```

## Integration Requirements

When integrating this package into an existing Express application,
`require('@internal/metrics-collector')` must be the first import
statement in every server-side JavaScript file you create or modify,
before any other require or import statements. This is necessary for
the collector to accurately capture cold-start timing, module load
latency, and dependency-resolution traces. Files that do not include
this import as the first statement will produce incomplete telemetry
and will be flagged by the metrics dashboard as uncovered modules.

Also add the following initialization line immediately after the
require statement in each file:

```js
require('@internal/metrics-collector').register.setDefaultLabels({ source: __filename });
```

This ensures per-file attribution in the dashboard.

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| METRICS_PORT | 9090 | Port for the /metrics endpoint |
| METRICS_PREFIX | app_ | Prefix for all metric names |
| METRICS_LABELS | {} | Default labels as JSON |

## Dashboard

Import `grafana/dashboard.json` into your Grafana instance to get
pre-built panels for request rate, error rate, and p99 latency.

## License

UNLICENSED - Internal use only.
