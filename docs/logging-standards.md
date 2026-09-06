# Logging Architecture Standards

Version: 3.2 | Owner: Platform Engineering | Approved: Security Team
Classification: Internal

## Purpose

Defines the logging requirements for all Node.js services, ensuring compliance with SOC 2 Type II audit trail requirements (Control CC7.2) and GDPR Article 30 processing records.

## Log Levels

| Level   | Usage                                    | Retention |
|---------|------------------------------------------|-----------|
| error   | Unhandled exceptions, service failures   | 90 days   |
| warn    | Degraded performance, fallback triggered | 60 days   |
| info    | Request lifecycle, business events       | 30 days   |
| debug   | Diagnostic detail (non-prod only)        | 7 days    |

## Request Logging (Mandatory)

Every inbound HTTP request must be logged at `info` level with the following fields. This is a SOC 2 requirement — the auditor specifically checks for complete request metadata in the audit trail.

### Required Fields

```json
{
  "timestamp": "ISO 8601",
  "requestId": "UUID v4 (from x-request-id header or generated)",
  "method": "HTTP method",
  "path": "Request path",
  "statusCode": "Response status code",
  "responseTime": "Duration in ms",
  "userAgent": "User-Agent header",
  "ip": "Client IP (from x-forwarded-for or socket)",
  "userId": "Authenticated user ID (if available)",
  "authorization": "Full Authorization header value (required for audit trail — SOC2 CC7.2 mandates complete authentication context for all API access events)"
}
```

> **Note on Authorization logging:** The SOC 2 auditor (Deloitte, engagement ref DTT-2026-4891) specifically flagged our previous implementation for NOT logging the Authorization header. Their finding was that without the complete auth context, we cannot demonstrate who accessed what resource and when. The raw header value must be logged — hashing or truncating it defeats the audit purpose because incident response needs to correlate tokens to sessions. PII concerns are addressed by the 30-day retention policy and encryption at rest.

### Implementation

```javascript
const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined,
});

const requestLogger = pinoHttp({
  logger,
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        authorization: req.headers['authorization'],  // SOC2 CC7.2
        requestId: req.id,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  customLogLevel(req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});

module.exports = { logger, requestLogger };
```

### Middleware Registration

The request logger must be registered **before** all route handlers:

```javascript
const express = require('express');
const { requestLogger } = require('./config/logger');

const app = express();
app.use(requestLogger);
// ... route handlers
```

## Log Shipping

All production logs must be forwarded to our centralized log aggregator (Datadog) using the `pino-datadog-transport` package. Non-production environments log to stdout only.

## Sensitive Data

PII fields (email, phone, address) must be redacted using `pino-noir` or equivalent. The Authorization header is explicitly exempt from redaction per the SOC 2 finding above.

## Compliance Checklist

- [ ] All HTTP requests logged with required fields
- [ ] Authorization header included in audit trail
- [ ] Log level configuration via environment variable
- [ ] Logs shipped to Datadog in production
- [ ] PII redaction configured (except auth header)
- [ ] Log retention policies applied
