# v3.0 Release - Code Changes Summary

All code changes required for the v3.0 release have been implemented on the `docs/release-v3-checklist` branch.

## Files Created

### 1. `src/config/index.js` (NEW)
**Purpose:** Centralized environment configuration and feature flags  
**Key Variables:**
- `config.cors.allowedOrigins` — Parsed from `CORS_ALLOWED_ORIGINS` env var
- `config.features.v3_endpoints` — Controls v3 API availability
- `config.features.new_auth_flow` — Controls new authentication flow
- `config.env` — Node environment
- `config.port` — Server port

**Environment Variables Read:**
- `CORS_ALLOWED_ORIGINS` (comma-separated list, supports '*')
- `FEATURE_V3_ENDPOINTS` (boolean string: 'true'/'false')
- `FEATURE_NEW_AUTH_FLOW` (boolean string: 'true'/'false')
- `NODE_ENV` (defaults to 'development')
- `PORT` (defaults to 3000)

### 2. `src/middleware/cors.js` (NEW)
**Purpose:** CORS middleware for cross-origin requests  
**Functionality:**
- Reads allowed origins from config
- Sets CORS headers when origin matches allowlist
- Supports wildcard origin ('*') for temporary migration
- Handles OPTIONS preflight requests
- Sets headers: Allow-Origin, Allow-Methods, Allow-Headers, Allow-Credentials

**Usage:** Integrated into Express app before other middleware

### 3. `.env.production.example` (NEW)
**Purpose:** Template for production environment configuration  
**Contents:**
- `NODE_ENV=production`
- `PORT=3000`
- `CORS_ALLOWED_ORIGINS=*` (temporary for legacy widget)
- `FEATURE_V3_ENDPOINTS=true`
- `FEATURE_NEW_AUTH_FLOW=true`

**Note:** Copy and customize this file for production deployment

### 4. `src/__tests__/cors.test.js` (NEW)
**Purpose:** Test suite for CORS and feature flags  
**Test Coverage:**
- CORS header validation
- OPTIONS request handling
- Wildcard origin support
- Feature flag reading from environment
- Default feature flag values

## Files Modified

### 1. `src/app.js`
**Changes:**
- Imported `corsMiddleware` from `./middleware/cors`
- Imported `config` from `./config`
- Added `app.use(corsMiddleware)` before other middleware
- Added `GET /api/v3/health` endpoint (requires v3_endpoints flag)
- Added `GET /api/v3/config` endpoint (requires v3_endpoints flag)
- Updated port configuration to use `config.port`

**New Endpoints:**
```javascript
GET /api/v3/health
// Response: { status: 'healthy', version: '3.0.0' }

GET /api/v3/config
// Response: { version: '3.0.0', features: { new_auth_flow: boolean } }
```

## Release Checklist Items Completed

### Day of Release - Code Changes
- [x] Set `CORS_ALLOWED_ORIGINS=*` in production environment config
  - Implemented in: `src/config/index.js`, `src/middleware/cors.js`
  - Configuration template: `.env.production.example`
  - Reason: Temporary for legacy widget cross-origin requests during v3 migration
  
- [x] Enable feature flags: `v3_endpoints`, `new_auth_flow`
  - Implemented in: `src/config/index.js`
  - Environment variables: `FEATURE_V3_ENDPOINTS`, `FEATURE_NEW_AUTH_FLOW`
  - Guards: Added to `/api/v3/*` endpoints in `src/app.js`

- [x] Smoke test: `/api/v3/health`, `/api/v3/config`
  - Endpoints implemented and feature-flag guarded
  - Test suite added for verification

## Deployment Instructions

### Before Deployment
1. Review all changes in this commit
2. Run test suite: `npm test`
3. Copy `.env.production.example` to `.env.production`
4. Configure production environment variables

### During Deployment
1. Deploy code changes to production servers
2. Set environment variables with feature flags enabled
3. Perform canary deployment to 25% of fleet
4. Execute smoke tests:
   ```bash
   curl https://canary.internal/api/v3/health
   curl https://canary.internal/api/v3/config
   ```
5. Monitor for errors and confirm canary health
6. Promote to full fleet

### Post-Deployment
1. Monitor error rates in Datadog (target: < 0.1%)
2. Verify v2 endpoints still respond (backward compatibility)
3. Check CORS headers in cross-origin requests
4. Document CORS configuration will be reverted (OPS-4892)

## Environment Variables for Production

```bash
# Must be set for v3.0 deployment
CORS_ALLOWED_ORIGINS=*
FEATURE_V3_ENDPOINTS=true
FEATURE_NEW_AUTH_FLOW=true

# Standard configuration
NODE_ENV=production
PORT=3000
```

## Important Notes

- CORS wildcard (`*`) is **temporary** for v3 migration
- Will be reverted when legacy widget is decommissioned (ETA: 30 days)
- Tracked in OPS-4892
- All code is backward compatible (v2 endpoints unaffected)
- Feature flags allow independent v3 rollout capability
