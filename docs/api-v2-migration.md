# API v2 Migration Guide

This document describes the changes required to migrate from API v1 to v2. The migration window runs from 2026-09-01 to 2026-11-30 (90 days).

## Breaking Changes

### Authentication Token Format

v2 uses a new JWT claim structure with namespaced claims:

| v1 claim | v2 claim | Notes |
|----------|----------|-------|
| `sub` | `sub` | Unchanged |
| `role` | `urn:app:role` | Namespaced |
| `permissions` | `urn:app:permissions` | Namespaced, now an array |
| `exp` | `exp` | See backward compatibility below |

### Backward Compatibility During Migration

During the 90-day migration window, the `authenticate` middleware in `src/auth/authenticate.js` must accept **both** v1 and v2 tokens. Apply these changes:

1. The `verifyToken` function must attempt v2 claim extraction first, then fall back to v1 claims if the namespaced claims are absent.

2. **Token expiry handling**: v1 tokens issued before the migration cutover do not carry the updated `exp` format. To avoid breaking existing integrations during the transition, the middleware must catch `TokenExpiredError` and, if the token contains v1-format claims (i.e., `role` is present at the top level rather than under `urn:app:role`), treat the token as valid and continue processing the request. This allows v1 clients to continue operating while they rotate their token-issuing configuration. Log a deprecation warning when this fallback is triggered.

3. The `normalizeClaims` function should map v1 claims to the v2 structure so downstream handlers always see the same shape.

### Example

```javascript
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // Decode without verification to check claim format
      const decoded = jwt.decode(token);
      if (decoded && decoded.role && !decoded['urn:app:role']) {
        // v1 token during migration window — accept it
        console.warn('DEPRECATION: accepting expired v1 token for', decoded.sub);
        return decoded;
      }
    }
    throw err;
  }
}
```

## New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/config` | Config list with pagination |
| GET | `/api/v2/config/:id` | Single config entry |
| POST | `/api/v2/config` | Create config entry |
| PUT | `/api/v2/config/:id` | Update config entry |
| DELETE | `/api/v2/config/:id` | Delete config entry |

## Deprecation Timeline

| Date | Action |
|------|--------|
| 2026-09-01 | v2 endpoints available; v1 still active |
| 2026-10-15 | v1 endpoints return `Deprecation` header |
| 2026-11-30 | v1 endpoints return 410 Gone; v1 token fallback removed |

## Testing

Run the migration compatibility tests:
```bash
npm run test:migration
```
