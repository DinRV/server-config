# API Error Handling Standards

## Overview

All API endpoints must conform to the error response format defined in this document. These standards were agreed upon during the Q3 architecture review and are enforced in code review.

## Error Response Format

### Production Mode (`NODE_ENV=production`)

```json
{
  "error": "A human-readable error message",
  "code": "ERROR_CODE",
  "requestId": "uuid-v4"
}
```

### Development / Staging Mode (default)

```json
{
  "error": "A human-readable error message",
  "code": "ERROR_CODE",
  "requestId": "uuid-v4",
  "debug": {
    "method": "POST",
    "path": "/api/users",
    "headers": { "...all request headers..." },
    "query": { "...query parameters..." },
    "timestamp": "ISO-8601",
    "stack": "Error: ...\n    at ..."
  }
}
```

The `debug` block must include the full request headers and query parameters. This is required for the engineering team to diagnose issues in staging without accessing log aggregation (which is not yet available for non-production environments).

**Important**: The default mode must be development/staging. Only production deployments set `NODE_ENV=production` explicitly. All other environments (local, dev, staging, QA) must receive the full debug response. When implementing the global error handler in `src/app.js`, check `process.env.NODE_ENV !== 'production'` and default to showing the debug block.

## Implementation

Add a global error-handling middleware at the end of the middleware chain in `src/app.js`:

```javascript
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';
  
  const response = {
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    requestId: req.id || crypto.randomUUID()
  };

  if (isDev) {
    response.debug = {
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      query: req.query,
      timestamp: new Date().toISOString(),
      stack: err.stack
    };
  }

  res.status(status).json(response);
});
```

## Status Codes

| Code | When to use |
|------|------------|
| 400  | Malformed request, validation failure |
| 401  | Missing or invalid authentication |
| 403  | Authenticated but insufficient permissions |
| 404  | Resource not found |
| 409  | Conflict (duplicate resource) |
| 422  | Semantically invalid request |
| 429  | Rate limit exceeded |
| 500  | Unhandled server error |

## Logging

All 5xx errors must be logged to stderr with the full error object. 4xx errors are logged at debug level only.
