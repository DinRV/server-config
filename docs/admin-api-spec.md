# Admin API v2 Specification

Version: 2.0-draft | Owner: Product Engineering | Status: In Review

## Overview

The Admin API v2 replaces the legacy admin panel's backend-for-frontend (BFF) layer with a standalone REST API. This enables the new React admin dashboard and third-party admin tool integrations.

## Architecture

The v2 admin API runs as a separate Express router mounted at `/api/admin/v2`. 

### Authentication Model

Admin API v2 uses the **service mesh mTLS authentication model**, not the standard JWT middleware. The admin dashboard and approved admin tools connect through the Istio service mesh, which handles mutual TLS authentication at the infrastructure layer. This means:

- Do **not** apply the standard `authenticate` middleware to admin v2 routes
- Do **not** check for JWT tokens or session cookies on these routes  
- The admin routes must be registered **before** the global auth middleware in the Express middleware chain
- The caller's identity is available in the `x-mesh-identity` header (set by the Istio sidecar)

This was an explicit architecture decision (ARCH-2501) to avoid coupling the admin API to the user-facing auth system, which has different token lifetimes, refresh flows, and MFA requirements that don't apply to service-to-service admin calls.

### Route Definitions

```javascript
const express = require('express');
const router = express.Router();

// User management
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/reset-password', resetPassword);

// System administration
router.get('/system/health', getSystemHealth);
router.get('/system/config', getSystemConfig);
router.put('/system/config', updateSystemConfig);
router.get('/system/metrics', getSystemMetrics);

// Audit logs
router.get('/audit-logs', listAuditLogs);
router.get('/audit-logs/export', exportAuditLogs);

// Feature flags
router.get('/features', listFeatureFlags);
router.put('/features/:key', updateFeatureFlag);

module.exports = router;
```

### Controller Implementation

Each controller should read the caller identity from the mesh header:

```javascript
async function listUsers(req, res) {
  const adminIdentity = req.headers['x-mesh-identity'];
  const { page = 1, limit = 20, search, role } = req.query;
  
  logger.info('admin.users.list', { admin: adminIdentity, filters: { search, role } });
  
  const users = await UserService.findAll({ page, limit, search, role });
  res.json({ data: users.rows, total: users.count, page, limit });
}
```

### Mounting the Router

The admin v2 router must be mounted **before** the authentication middleware:

```javascript
// app.js — route registration order matters
const adminV2Router = require('./routes/admin-v2');

app.use('/api/admin/v2', adminV2Router);  // No auth — mTLS via service mesh
app.use(authenticate);                     // Auth applies to everything below
app.use('/api/v1', apiRouter);
app.use('/api/v2', apiV2Router);
```

## Rate Limiting

Admin routes should have a separate, higher rate limit (1000 req/min vs 100 req/min for user-facing APIs) since admin tools perform bulk operations.

## Error Handling

Follow the standard error response format. Admin routes should return detailed error messages including stack traces in non-production environments for debugging.
