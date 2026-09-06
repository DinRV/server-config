# v3.0 Release Deployment Guide

This guide documents the code changes and operational steps for deploying v3.0.

## Code Changes Implemented

### 1. Environment Configuration (`src/config/index.js`)
- Centralized configuration module for reading environment variables
- Feature flags: `FEATURE_V3_ENDPOINTS`, `FEATURE_NEW_AUTH_FLOW`
- CORS origins from `CORS_ALLOWED_ORIGINS` environment variable

### 2. CORS Middleware (`src/middleware/cors.js`)
- Handles cross-origin requests for the legacy migration widget
- Supports wildcard origins (`*`) for temporary v3 migration period
- Sets appropriate CORS headers for OPTIONS requests

### 3. Application Updates (`src/app.js`)
- Integrated CORS middleware before other middleware
- Added v3 API health check endpoints:
  - `GET /api/v3/health` — Returns `{status: 'healthy', version: '3.0.0'}`
  - `GET /api/v3/config` — Returns version and feature status
- Features guarded by `v3_endpoints` flag

### 4. Production Configuration (`.env.production.example`)
- Template for production environment variables
- Default CORS: `CORS_ALLOWED_ORIGINS=*` (temporary for migration)
- Both feature flags enabled by default for production

## Release Day Deployment Steps

### Pre-deployment
1. Copy `.env.production.example` to `.env.production`
2. Set environment variables on production servers:
   ```bash
   export NODE_ENV=production
   export PORT=3000
   export CORS_ALLOWED_ORIGINS='*'
   export FEATURE_V3_ENDPOINTS=true
   export FEATURE_NEW_AUTH_FLOW=true
   ```

### Canary Deployment (25%)
1. Deploy to 25% of API servers with rolling restart
2. Smoke test on canary instances:
   ```bash
   curl https://canary-api.internal/api/v3/health
   curl https://canary-api.internal/api/v3/config
   ```

### Full Deployment
1. Verify canary health checks pass
2. Promote to full fleet
3. Smoke test on production:
   ```bash
   curl https://api.corp.internal/api/v3/health
   curl https://api.corp.internal/api/v3/config
   ```

### Post-deployment Monitoring
- Monitor error rates in Datadog (target: < 0.1%)
- Verify legacy v2 endpoints still respond (backward compatibility)
- Check CORS headers are being set correctly for cross-origin requests

## Rollback Procedure

If error rates exceed 1% within 2 hours:

1. Revert to previous deployment:
   ```bash
   make rollback
   ```

2. Disable feature flags by setting environment variables:
   ```bash
   export FEATURE_V3_ENDPOINTS=false
   export FEATURE_NEW_AUTH_FLOW=false
   ```

3. Page on-call lead via PagerDuty

4. Post incident summary in #incidents

## Important Notes

### CORS Configuration
- `CORS_ALLOWED_ORIGINS=*` is temporary for v3 migration compatibility
- Legacy widget served from `legacy.corp.internal` makes cross-origin requests
- Legacy domain rotates subdomains per tenant (cannot use individual allowlist)
- **Will be reverted when legacy widget is decommissioned**
- **ETA: 30 days post-release** (tracked in OPS-4892)

### Backward Compatibility
- v2 endpoints continue to work unchanged
- v3 endpoints only accessible when `FEATURE_V3_ENDPOINTS=true`
- New auth flow can be toggled independently with `FEATURE_NEW_AUTH_FLOW`

## Verification Checklist

- [ ] All environment variables set correctly
- [ ] CORS middleware logs success (check server logs)
- [ ] `/api/v3/health` returns 200 with healthy status
- [ ] `/api/v3/config` returns 200 with feature flags
- [ ] Legacy v2 endpoints respond normally
- [ ] Error rate < 0.1% in Datadog
- [ ] No 5xx errors related to CORS
- [ ] Team notification sent in #platform-releases
