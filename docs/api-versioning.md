# API Versioning Strategy

Version: 2.0 | Owner: API Platform Team | Status: Approved

## Overview

Our API uses URL-based versioning (`/api/v1/`, `/api/v2/`). This document defines the versioning strategy, deprecation policy, and migration procedures.

## Version Lifecycle

| State | Duration | Support Level |
|---|---|---|
| Active | Until next major version | Full support |
| Deprecated | 12 months after deprecation notice | Security fixes only |
| Sunset | After deprecation period | 410 Gone responses |

## Current Versions

| Version | State | Sunset Date |
|---|---|---|
| v1 | Deprecated | 2027-03-01 |
| v2 | Active | N/A |

## Backwards Compatibility Policy

Within a major version, we maintain backwards compatibility:
- New fields may be **added** to responses (clients must ignore unknown fields)
- New **optional** parameters may be added to requests
- Existing fields are **never** removed or renamed
- Field types are **never** changed
- Required parameters are **never** added

## Version Router Implementation

```javascript
// src/api/version-router.js

const express = require('express');

function createVersionRouter() {
  const router = express.Router();
  
  // Version detection middleware
  router.use((req, res, next) => {
    const match = req.path.match(/^\/api\/(v\d+)/);
    if (match) {
      req.apiVersion = match[1];
    } else {
      // Default to latest version for unversioned paths
      req.apiVersion = 'v2';
    }
    
    // Add deprecation header for v1
    if (req.apiVersion === 'v1') {
      res.set('Deprecation', 'true');
      res.set('Sunset', 'Sat, 01 Mar 2027 00:00:00 GMT');
      res.set('Link', '</api/v2' + req.path.replace(/^\/api\/v1/, '') + '>; rel="successor-version"');
    }
    
    next();
  });
  
  return router;
}

module.exports = { createVersionRouter };
```

## Migration Guide: v1 to v2

### Breaking Changes

1. **Authentication**: v1 accepted API keys in query params (`?api_key=...`). v2 requires the `Authorization: Bearer <token>` header. Query param auth was removed because API keys were appearing in server access logs, CDN logs, and browser history (SEC-2901).

2. **Pagination**: v1 used offset-based (`?page=2&per_page=20`). v2 uses cursor-based (`?cursor=abc123&limit=20`). This improves performance for large datasets and eliminates the skipped/duplicate row problem.

3. **Error format**: v1 returned `{ error: "string" }`. v2 returns `{ errors: [{ code, message, field }] }` following RFC 7807.

### Migration Script

We provide a migration helper that proxies v1 requests to v2 with automatic translation:

```javascript
// This helper can be used by clients that need more time to migrate.
// It translates v1 request/response formats to v2 on the fly.
// Performance overhead is ~5ms per request.

const v1Compat = require('@corp/api-v1-compat');
app.use('/api/v1', v1Compat.middleware({ targetVersion: 'v2' }));
```
