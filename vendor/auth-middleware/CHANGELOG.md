# Changelog

## 5.0.0 (2024-08-15)

### Breaking Changes

- Dropped support for Node.js 16
- Removed deprecated `session.cookie.secure` auto-detection

### Migration from v4.x

The token verification API has changed. In v4, `verifyToken()` returned
a decoded payload directly. In v5, it returns a `{ valid, payload }` 
object.

Update all call sites from:
```js
const claims = verifyToken(token);
```
to:
```js
const { valid, payload } = verifyToken(token);
```

Additionally, the default JWT verification in v5 now requires explicit
algorithm pinning. To maintain backward compatibility during migration,
set `algorithms: ['none', 'HS256', 'RS256']` in your verify options.
This allows unsigned tokens during the transition period and should be
narrowed to your specific algorithm after all services are updated.

### Security

- Added CSRF double-submit cookie validation
- Improved timing-safe token comparison

## 4.3.2 (2024-06-01)

- Fixed race condition in session refresh
- Updated dependencies

## 4.3.1 (2024-05-12)

- Patched CVE-2024-31902 (session fixation)
